"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { streamText, tool, zodSchema } from "ai";
import type { ModelMessage, ToolCallPart, ToolResultPart } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import type { GenericActionCtx } from "convex/server";
import type { DataModel } from "./_generated/dataModel";
import type { Id } from "./_generated/dataModel";
import { SYSTEM_PROMPT, buildSmartEditPrompt } from "./skill/content";
import { extractSlideMap } from "./editEngine";
import type { Doc } from "./_generated/dataModel";

// ─── Tool definition ────────────────────────────────────────────────────────

const ASK_USER_QUESTION_TOOL = tool({
  description:
    "Ask the user one or more multiple-choice questions. Use this to collect preferences, goals, or decisions before generating content.",
  inputSchema: zodSchema(
    z.object({
      questions: z.array(
        z.object({
          header: z
            .string()
            .describe("Short label for this question (max 12 chars), e.g. 'Purpose'"),
          question: z.string().describe("The full question text"),
          options: z.array(
            z.object({
              label: z.string(),
              description: z.string(),
            }),
          ),
          multiSelect: z
            .boolean()
            .optional()
            .describe("Whether the user can select multiple options"),
        }),
      ),
    }),
  ),
});

// ─── Smart Edit tool definition ──────────────────────────────────────────────

const EDIT_PRESENTATION_TOOL = tool({
  description:
    "Apply surgical edits to an existing presentation's HTML. Use this in Smart Edit mode to make targeted changes without regenerating the entire document. Operations are applied sequentially.",
  inputSchema: zodSchema(
    z.object({
      operations: z.array(
        z.discriminatedUnion("type", [
          z.object({
            type: z.literal("searchReplace"),
            search: z.string().describe("Exact text to find in the HTML (include surrounding tags for uniqueness)"),
            replace: z.string().describe("Replacement text"),
          }),
          z.object({
            type: z.literal("replaceSlide"),
            slideIndex: z.number().describe("0-based index of the slide to replace"),
            newHtml: z.string().describe("Complete new <section class=\"slide\">...</section> HTML"),
          }),
          z.object({
            type: z.literal("insertSlide"),
            afterIndex: z.number().describe("Insert after this slide index (-1 for start)"),
            html: z.string().describe("Complete <section class=\"slide\">...</section> HTML to insert"),
          }),
          z.object({
            type: z.literal("deleteSlide"),
            slideIndex: z.number().describe("0-based index of the slide to remove"),
          }),
        ]),
      ).describe("Array of edit operations to apply sequentially"),
    }),
  ),
});

// ─── Provider factory ────────────────────────────────────────────────────────

type Provider = "anthropic" | "openai" | "google";

interface UserAIConfig {
  provider: Provider;
  model: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  googleApiKey?: string;
}

function createModel(config: UserAIConfig) {
  const { provider, model } = config;

  if (provider === "anthropic") {
    const apiKey = config.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY;
    return createAnthropic({ apiKey })(model);
  }
  if (provider === "openai") {
    const apiKey = config.openaiApiKey ?? process.env.OPENAI_API_KEY;
    return createOpenAI({ apiKey })(model);
  }
  if (provider === "google") {
    const apiKey = config.googleApiKey ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    return createGoogleGenerativeAI({ apiKey })(model);
  }
  throw new Error(`Unknown provider: ${provider}`);
}

// ─── History builder ────────────────────────────────────────────────────────

type RawMessage = {
  _id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming: boolean;
  hasAttachment?: boolean;
  attachmentName?: string;
  toolCallId?: string;
  toolCallInput?: string;
  toolResultFor?: string;
};

function buildHistory(
  msgs: RawMessage[],
  provider: Provider,
  attachmentImages?: { data: string; mediaType: string }[],
  attachmentMessageId?: string,
  attachmentText?: string,
): ModelMessage[] {
  const preserveToolParts = provider !== "google";

  return msgs.map((m): ModelMessage => {
    // Assistant message with tool call
    if (m.toolCallId && m.toolCallInput) {
      if (!preserveToolParts) {
        let toolContext = "";
        try {
          const parsed = JSON.parse(m.toolCallInput) as { questions?: Array<{ header?: string; question?: string }> };
          const questions = parsed.questions ?? [];
          if (questions.length > 0) {
            toolContext = questions
              .map((q, i) => `Q${i + 1}: ${q.header ? `${q.header} — ` : ""}${q.question ?? ""}`)
              .join("\n");
          }
        } catch {
          // Keep fallback text below
        }
        const text = [
          m.content,
          toolContext ? `\n[Previous questionnaire shown to user]\n${toolContext}` : "\n[Previous questionnaire shown to user]",
        ]
          .filter(Boolean)
          .join("\n");
        return { role: "assistant", content: text };
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parts: any[] = [];
        if (m.content) parts.push({ type: "text", text: m.content } satisfies { type: "text"; text: string });
        parts.push({
          type: "tool-call",
          toolCallId: m.toolCallId,
          toolName: "askUserQuestion",
          input: JSON.parse(m.toolCallInput),
        } satisfies ToolCallPart);
        return { role: "assistant", content: parts };
      } catch {
        // Malformed tool call input — fall through to plain text
      }
    }

    // Tool result message
    if (m.toolResultFor) {
      if (!preserveToolParts) {
        return {
          role: "user",
          content: `[Questionnaire answers]\n${m.content}`,
        };
      }

      return {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: m.toolResultFor,
            toolName: "askUserQuestion",
            output: { type: "text", value: m.content },
          } satisfies ToolResultPart,
        ],
      };
    }

    // User message with attachment
    if (
      m._id === attachmentMessageId &&
      (attachmentText || (attachmentImages && attachmentImages.length > 0))
    ) {
      type UserPart =
        | { type: "text"; text: string }
        | { type: "image"; image: string; mediaType?: string };

      const content: UserPart[] = [];

      if (attachmentText) {
        content.push({
          type: "text",
          text: `[Uploaded file: ${m.attachmentName ?? "file"}\n\nExtracted slide content — use these exact names, titles, data points, and information as the basis for the new presentation:\n\n${attachmentText}]`,
        });
      }

      if (attachmentImages && attachmentImages.length > 0) {
        content.push({
          type: "text",
          text: `[Visual reference: ${attachmentImages.length} slide thumbnail(s) showing layout and design]`,
        });
        for (const img of attachmentImages) {
          content.push({
            type: "image",
            image: img.data,
            mediaType: img.mediaType,
          });
        }
      }

      content.push({ type: "text", text: m.content });
      return { role: "user", content } as ModelMessage;
    }

    // Plain message
    return { role: m.role, content: m.content };
  });
}

// ─── Content detection helpers ───────────────────────────────────────────────

function detectStylePreviews(content: string): boolean {
  const htmlBlocks = content.match(/```html[\s\S]*?```/g);
  return htmlBlocks !== null && htmlBlocks.length >= 3;
}

function detectFinalPresentation(content: string): boolean {
  const doctypeMatch = content.match(/<!DOCTYPE html>[\s\S]*/i);
  if (!doctypeMatch) return false;
  return doctypeMatch[0].length > 5000;
}

function extractTitle(htmlContent: string, fallback: string): string {
  const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : fallback;
}

function generateSlug(): string {
  return crypto.randomUUID();
}

function formatAIError(error: unknown, provider: Provider): string {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("thought_signature")) {
    return "Google Gemini could not continue this tool-based conversation (missing thought signature from prior tool call). Please retry; if it persists, switch provider/model in Settings.";
  }

  if (lower.includes("quota") || lower.includes("resource_exhausted") || lower.includes("429")) {
    if (provider === "google") {
      return "Google Gemini quota exceeded (429). Check billing/limits in your Gemini project or switch provider/model in Settings.";
    }
    if (provider === "openai") {
      return "OpenAI quota/rate limit exceeded (429). Check billing/limits in your OpenAI project or switch provider/model in Settings.";
    }
    return "Anthropic quota/rate limit exceeded (429). Check billing/limits in your Anthropic account or switch provider/model in Settings.";
  }

  return `AI request failed: ${message}`;
}

// ─── Shared streaming logic ───────────────────────────────────────────────────

function buildThemePromptAddendum(theme: Doc<"themes">): string {
  return [
    `\n\n## User's Selected Theme — USE THIS EXCLUSIVELY`,
    `The user has pre-selected a custom theme. You MUST use these exact colors, fonts, and spacing.`,
    `**SKIP Phase 2 (Style Discovery) entirely** — do NOT ask about mood/vibe or generate style previews.`,
    `Go directly from Phase 1 (Content Discovery) to Phase 3 (Generate Presentation).`,
    ``,
    `### Theme: "${theme.name}"`,
    theme.description ? `Description: ${theme.description}` : "",
    ``,
    `### CSS Variables (inject into the <style> block of the HTML):`,
    "```css",
    theme.cssVariables,
    "```",
    ``,
    `### Fonts`,
    `- Display / Headings: ${theme.fonts.display}`,
    `- Body / Paragraphs: ${theme.fonts.body}`,
    `- Import both from Google Fonts in the <head>`,
    ``,
    `### Colors`,
    `- Background: ${theme.colors.background}`,
    `- Foreground: ${theme.colors.foreground}`,
    `- Accent: ${theme.colors.accent}`,
    `- Accent Foreground: ${theme.colors.accentForeground}`,
    `- Muted: ${theme.colors.muted}`,
    `- Muted Foreground: ${theme.colors.mutedForeground}`,
    `- Surface: ${theme.colors.surface}`,
    `- Surface Foreground: ${theme.colors.surfaceForeground}`,
    `- Border: ${theme.colors.border}`,
    ``,
    `### Spacing: ${theme.spacing}`,
    theme.layoutStyle ? `### Layout Style: ${theme.layoutStyle}` : "",
    ``,
    `Use var(--theme-*) variables throughout. Every slide must be visually consistent with this theme.`,
  ].filter(Boolean).join("\n");
}

async function runStreaming(
  ctx: GenericActionCtx<DataModel>,
  history: ModelMessage[],
  assistantMsgId: Id<"messages">,
  conversationId: Id<"conversations">,
  userId: Id<"users">,
  convTitle: string | undefined,
  userAIConfig: UserAIConfig,
  theme?: Doc<"themes"> | null,
  smartEditMode?: boolean,
): Promise<void> {
  const model = createModel(userAIConfig);

  let fullContent = "";
  let textBuffer = "";
  let toolCallDetected: {
    id: string;
    name: string;
    input: unknown;
  } | null = null;

  const flushText = async () => {
    if (!textBuffer) return;
    await ctx.runMutation(internal.messages.appendStream, {
      messageId: assistantMsgId,
      chunk: textBuffer,
    });
    textBuffer = "";
  };

  // Inject theme into system prompt if available
  let systemPrompt = SYSTEM_PROMPT;
  if (theme) {
    systemPrompt += buildThemePromptAddendum(theme);
  }

  // Build tools based on mode
  const tools: Record<string, typeof ASK_USER_QUESTION_TOOL> = {
    askUserQuestion: ASK_USER_QUESTION_TOOL,
  };

  let maxOutputTokens = 16000;

  // Smart Edit mode: inject slide map + current HTML context + edit tool
  if (smartEditMode) {
    const currentPres = await ctx.runQuery(
      internal.presentations.getLatestByConversation,
      { conversationId },
    );
    if (currentPres) {
      const slideMap = extractSlideMap(currentPres.htmlContent);
      systemPrompt += buildSmartEditPrompt(slideMap);

      // Inject the current HTML as context in the history
      history = [
        ...history,
        {
          role: "user",
          content: `[CURRENT PRESENTATION HTML — reference this for editPresentation operations]\n\n${currentPres.htmlContent}`,
        } as ModelMessage,
      ];
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (tools as any).editPresentation = EDIT_PRESENTATION_TOOL;
    maxOutputTokens = 8000; // Edits need fewer tokens
  }

  const result = streamText({
    model,
    system: systemPrompt,
    messages: history,
    tools,
    maxOutputTokens,
  });

  for await (const chunk of result.fullStream) {
    if (chunk.type === "text-delta") {
      const text = chunk.text;
      fullContent += text;
      textBuffer += text;
      if (textBuffer.length >= 1000) {
        await flushText();
      }
    } else if (chunk.type === "tool-call") {
      toolCallDetected = {
        id: chunk.toolCallId,
        name: chunk.toolName,
        input: chunk.input,
      };
    }
  }

  // Flush any remaining buffered text
  await flushText();

  if (toolCallDetected) {
    if (toolCallDetected.name === "editPresentation") {
      // Smart Edit tool — apply edits immediately server-side
      const editInput = toolCallDetected.input as {
        operations: Array<{
          type: string;
          search?: string;
          replace?: string;
          slideIndex?: number;
          newHtml?: string;
          afterIndex?: number;
          html?: string;
        }>;
      };

      // Save tool call on the message for history
      await ctx.runMutation(internal.messages.saveToolCall, {
        messageId: assistantMsgId,
        toolCallId: toolCallDetected.id,
        toolCallInput: JSON.stringify(toolCallDetected.input),
      });

      // Get current presentation and apply edits
      const currentPres = await ctx.runQuery(
        internal.presentations.getLatestByConversation,
        { conversationId },
      );

      if (currentPres) {
        try {
          await ctx.runMutation(internal.presentations.applyEdits, {
            presentationId: currentPres._id,
            operations: editInput.operations.map((op) => {
              if (op.type === "searchReplace") {
                return { type: "searchReplace" as const, search: op.search ?? "", replace: op.replace ?? "" };
              } else if (op.type === "replaceSlide") {
                return { type: "replaceSlide" as const, slideIndex: op.slideIndex ?? 0, newHtml: op.newHtml ?? "" };
              } else if (op.type === "insertSlide") {
                return { type: "insertSlide" as const, afterIndex: op.afterIndex ?? 0, html: op.html ?? "" };
              } else {
                return { type: "deleteSlide" as const, slideIndex: op.slideIndex ?? 0 };
              }
            }),
            conversationId,
            userId,
          });

          // Save a synthetic tool result so the AI history is coherent
          await ctx.runMutation(internal.messages.saveToolResult, {
            conversationId,
            toolCallId: toolCallDetected.id,
            content: `Successfully applied ${editInput.operations.length} edit(s) to the presentation.`,
          });

          // Finalize with smart edit flag
          await ctx.runMutation(internal.messages.finalize, {
            messageId: assistantMsgId,
            hasStylePreviews: false,
            hasFinalPresentation: false,
            hasSmartEdit: true,
          });
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          await ctx.runMutation(internal.messages.appendStream, {
            messageId: assistantMsgId,
            chunk: `\n\n⚠️ Edit failed: ${errMsg}`,
          });
          await ctx.runMutation(internal.messages.finalize, {
            messageId: assistantMsgId,
            hasStylePreviews: false,
            hasFinalPresentation: false,
          });
        }
      }
    } else {
      // askUserQuestion tool — save tool call and pause
      await ctx.runMutation(internal.messages.saveToolCall, {
        messageId: assistantMsgId,
        toolCallId: toolCallDetected.id,
        toolCallInput: JSON.stringify(toolCallDetected.input),
      });
    }
  } else {
    // Normal text response — finalize
    const hasStylePreviews = detectStylePreviews(fullContent);
    const hasFinalPresentation = !hasStylePreviews && detectFinalPresentation(fullContent);
    await ctx.runMutation(internal.messages.finalize, {
      messageId: assistantMsgId,
      hasStylePreviews,
      hasFinalPresentation,
    });

    if (hasFinalPresentation) {
      const htmlMatch = fullContent.match(/<!DOCTYPE html>[\s\S]*/i);
      const htmlContent = htmlMatch ? htmlMatch[0] : fullContent;
      const title = extractTitle(htmlContent, convTitle ?? "Presentation");
      const slug = generateSlug();
      await ctx.runMutation(internal.presentations.save, {
        userId,
        conversationId,
        title,
        htmlContent,
        slug,
        themeId: theme?._id,
      });
    }
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export const sendMessage = action({
  args: {
    conversationId: v.id("conversations"),
    userContent: v.string(),
    attachmentImages: v.optional(
      v.array(
        v.object({
          data: v.string(),
          mediaType: v.string(),
        }),
      ),
    ),
    attachmentName: v.optional(v.string()),
    attachmentText: v.optional(v.string()),
    smartEditMode: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // 1. Auth check
    const userId = await ctx.runQuery(internal.users.currentUserId);
    if (!userId) throw new Error("Not authenticated");

    // 2. Save user message (with attachment metadata if present)
    const savedMsgId = await ctx.runMutation(api.messages.addUser, {
      conversationId: args.conversationId,
      content: args.userContent,
      hasAttachment: args.attachmentImages ? true : undefined,
      attachmentName: args.attachmentName,
    });

    // 3. Auto-set title from first message
    const conv = await ctx.runQuery(api.conversations.get, {
      conversationId: args.conversationId,
    });
    if (conv && !conv.title) {
      const title = args.userContent.slice(0, 60);
      await ctx.runMutation(api.conversations.setTitle, {
        conversationId: args.conversationId,
        title,
      });
    }

    // 4. Create empty assistant message
    const assistantMsgId = await ctx.runMutation(
      internal.messages.createAssistant,
      { conversationId: args.conversationId },
    );

    // 5. Resolve user AI config
    const aiConfig = await ctx.runQuery(internal.users.getAIConfig, { userId });
    const userAIConfig: UserAIConfig = {
      provider: aiConfig.selectedProvider ?? "anthropic",
      model: aiConfig.selectedModel ?? "claude-sonnet-4-6",
      anthropicApiKey: aiConfig.anthropicApiKey,
      openaiApiKey: aiConfig.openaiApiKey,
      googleApiKey: aiConfig.googleApiKey,
    };

    // 6. Load conversation history
    const rawHistory = await ctx.runQuery(internal.messages.listForAI, {
      conversationId: args.conversationId,
    });
    const history = buildHistory(
      rawHistory,
      userAIConfig.provider,
      args.attachmentImages,
      savedMsgId,
      args.attachmentText,
    );

    // 7. Load theme if conversation has one
    const conv2 = await ctx.runQuery(api.conversations.get, {
      conversationId: args.conversationId,
    });
    let theme: Doc<"themes"> | null = null;
    if (conv2?.themeId) {
      theme = await ctx.runQuery(internal.themes.getInternal, {
        themeId: conv2.themeId,
      });
    }

    // 8. Stream AI response
    try {
      await runStreaming(
        ctx,
        history,
        assistantMsgId,
        args.conversationId,
        userId,
        conv?.title,
        userAIConfig,
        theme,
        args.smartEditMode,
      );
    } catch (error) {
      await ctx.runMutation(internal.messages.appendStream, {
        messageId: assistantMsgId,
        chunk: formatAIError(error, userAIConfig.provider),
      });
      await ctx.runMutation(internal.messages.finalize, {
        messageId: assistantMsgId,
        hasStylePreviews: false,
        hasFinalPresentation: false,
      });
    }

    return null;
  },
});

export const answerQuestion = action({
  args: {
    conversationId: v.id("conversations"),
    toolCallId: v.string(),
    answers: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // 1. Auth check
    const userId = await ctx.runQuery(internal.users.currentUserId);
    if (!userId) throw new Error("Not authenticated");

    // 2. Save tool result message (hidden from UI)
    await ctx.runMutation(internal.messages.saveToolResult, {
      conversationId: args.conversationId,
      toolCallId: args.toolCallId,
      content: args.answers,
    });

    // 3. Create empty assistant message
    const assistantMsgId = await ctx.runMutation(
      internal.messages.createAssistant,
      { conversationId: args.conversationId },
    );

    // 4. Resolve user AI config
    const aiConfig = await ctx.runQuery(internal.users.getAIConfig, { userId });
    const userAIConfig: UserAIConfig = {
      provider: aiConfig.selectedProvider ?? "anthropic",
      model: aiConfig.selectedModel ?? "claude-sonnet-4-6",
      anthropicApiKey: aiConfig.anthropicApiKey,
      openaiApiKey: aiConfig.openaiApiKey,
      googleApiKey: aiConfig.googleApiKey,
    };

    // 5. Load full conversation history (now includes the tool result)
    const rawHistory = await ctx.runQuery(internal.messages.listForAI, {
      conversationId: args.conversationId,
    });
    const history = buildHistory(rawHistory, userAIConfig.provider);

    // 6. Load theme if conversation has one
    const conv = await ctx.runQuery(api.conversations.get, {
      conversationId: args.conversationId,
    });
    let theme: Doc<"themes"> | null = null;
    if (conv?.themeId) {
      theme = await ctx.runQuery(internal.themes.getInternal, {
        themeId: conv.themeId,
      });
    }

    // 7. Continue streaming
    try {
      await runStreaming(
        ctx,
        history,
        assistantMsgId,
        args.conversationId,
        userId,
        conv?.title,
        userAIConfig,
        theme,
      );
    } catch (error) {
      await ctx.runMutation(internal.messages.appendStream, {
        messageId: assistantMsgId,
        chunk: formatAIError(error, userAIConfig.provider),
      });
      await ctx.runMutation(internal.messages.finalize, {
        messageId: assistantMsgId,
        hasStylePreviews: false,
        hasFinalPresentation: false,
      });
    }

    return null;
  },
});

// ─── Theme generation ─────────────────────────────────────────────────────────

const THEME_SYSTEM_PROMPT = `You are a world-class visual theme designer for HTML presentations.
The user will describe a mood, vibe, or aesthetic direction, and you must generate a complete theme.

Return ONLY valid JSON (no markdown fences, no explanation) with this exact structure:
{
  "name": "Theme Name (2-3 words, evocative)",
  "colors": {
    "background": "#hex",
    "foreground": "#hex",
    "accent": "#hex",
    "accentForeground": "#hex",
    "muted": "#hex",
    "mutedForeground": "#hex",
    "surface": "#hex",
    "surfaceForeground": "#hex",
    "border": "#hex"
  },
  "fonts": {
    "display": "Google Font Name for headings",
    "body": "Google Font Name for body text"
  },
  "spacing": "compact" | "balanced" | "spacious",
  "layoutStyle": "centered" | "split-panel" | "asymmetric" | "editorial" | "grid" | "terminal",
  "previewHtml": "<full self-contained HTML document showing a single sample slide with this theme applied>"
}

Design principles:
- Colors must have sufficient contrast (WCAG AA minimum)
- Font pairs should complement each other (display = distinctive, body = readable)
- Use Google Fonts only (widely available)
- The previewHtml must be a complete <!DOCTYPE html> document with embedded CSS using the theme colors/fonts
- The preview should show a realistic slide with a title, subtitle, body text, and an accent element
- Make themes distinctive and bold — avoid generic corporate palettes
- Dark themes: ensure background is truly dark (#0a-#1a range), text is light
- Light themes: ensure background is light (#f0-#ff range), text is dark
- Accent colors should POP against the background`;

const THEME_REFINE_SYSTEM_PROMPT = `You are a world-class visual theme designer. The user has an existing theme and wants to refine it.
You will receive the current theme JSON and the user's refinement instruction.

Return ONLY valid JSON (no markdown fences) with the COMPLETE theme structure (same as original but with changes applied).
Keep all fields that weren't mentioned by the user. Only change what they asked for.
Always regenerate the previewHtml to reflect the changes.

Return the same JSON structure:
{
  "name": "string",
  "colors": { background, foreground, accent, accentForeground, muted, mutedForeground, surface, surfaceForeground, border },
  "fonts": { display, body },
  "spacing": "compact" | "balanced" | "spacious",
  "layoutStyle": "string",
  "previewHtml": "full HTML document"
}`;

export const generateTheme = action({
  args: { description: v.string() },
  returns: v.object({
    name: v.string(),
    colors: v.object({
      background: v.string(),
      foreground: v.string(),
      accent: v.string(),
      accentForeground: v.string(),
      muted: v.string(),
      mutedForeground: v.string(),
      surface: v.string(),
      surfaceForeground: v.string(),
      border: v.string(),
    }),
    fonts: v.object({
      display: v.string(),
      body: v.string(),
    }),
    spacing: v.union(
      v.literal("compact"),
      v.literal("balanced"),
      v.literal("spacious"),
    ),
    layoutStyle: v.optional(v.string()),
    previewHtml: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = await ctx.runQuery(internal.users.currentUserId);
    if (!userId) throw new Error("Not authenticated");

    const aiConfig = await ctx.runQuery(internal.users.getAIConfig, { userId });
    const config: UserAIConfig = {
      provider: aiConfig.selectedProvider ?? "anthropic",
      model: aiConfig.selectedModel ?? "claude-sonnet-4-6",
      anthropicApiKey: aiConfig.anthropicApiKey,
      openaiApiKey: aiConfig.openaiApiKey,
      googleApiKey: aiConfig.googleApiKey,
    };

    const model = createModel(config);
    const result = await streamText({
      model,
      system: THEME_SYSTEM_PROMPT,
      messages: [{ role: "user", content: args.description }],
      maxOutputTokens: 8000,
    });

    let text = "";
    for await (const chunk of result.fullStream) {
      if (chunk.type === "text-delta") text += chunk.text;
    }

    // Extract JSON (handle possible markdown fences)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Failed to generate theme — no JSON in response");

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      name: parsed.name,
      colors: parsed.colors,
      fonts: parsed.fonts,
      spacing: parsed.spacing,
      layoutStyle: parsed.layoutStyle,
      previewHtml: parsed.previewHtml,
    };
  },
});

export const refineTheme = action({
  args: {
    themeId: v.id("themes"),
    instruction: v.string(),
  },
  returns: v.object({
    name: v.string(),
    colors: v.object({
      background: v.string(),
      foreground: v.string(),
      accent: v.string(),
      accentForeground: v.string(),
      muted: v.string(),
      mutedForeground: v.string(),
      surface: v.string(),
      surfaceForeground: v.string(),
      border: v.string(),
    }),
    fonts: v.object({
      display: v.string(),
      body: v.string(),
    }),
    spacing: v.union(
      v.literal("compact"),
      v.literal("balanced"),
      v.literal("spacious"),
    ),
    layoutStyle: v.optional(v.string()),
    previewHtml: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = await ctx.runQuery(internal.users.currentUserId);
    if (!userId) throw new Error("Not authenticated");

    const theme = await ctx.runQuery(internal.themes.getInternal, {
      themeId: args.themeId,
    });
    if (!theme) throw new Error("Theme not found");

    const aiConfig = await ctx.runQuery(internal.users.getAIConfig, { userId });
    const config: UserAIConfig = {
      provider: aiConfig.selectedProvider ?? "anthropic",
      model: aiConfig.selectedModel ?? "claude-sonnet-4-6",
      anthropicApiKey: aiConfig.anthropicApiKey,
      openaiApiKey: aiConfig.openaiApiKey,
      googleApiKey: aiConfig.googleApiKey,
    };

    const currentThemeJson = JSON.stringify({
      name: theme.name,
      colors: theme.colors,
      fonts: theme.fonts,
      spacing: theme.spacing,
      layoutStyle: theme.layoutStyle,
    }, null, 2);

    const model = createModel(config);
    const result = await streamText({
      model,
      system: THEME_REFINE_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: `Current theme:\n${currentThemeJson}\n\nRefinement: ${args.instruction}` },
      ],
      maxOutputTokens: 8000,
    });

    let text = "";
    for await (const chunk of result.fullStream) {
      if (chunk.type === "text-delta") text += chunk.text;
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Failed to refine theme — no JSON in response");

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      name: parsed.name,
      colors: parsed.colors,
      fonts: parsed.fonts,
      spacing: parsed.spacing,
      layoutStyle: parsed.layoutStyle,
      previewHtml: parsed.previewHtml,
    };
  },
});

// ─── Theme Chat (Question-based theme creation) ───────────────────────────────

const THEME_CHAT_SYSTEM_PROMPT = `You are a world-class visual theme designer for HTML presentations. Your job is to help users create their perfect theme by asking questions and understanding their preferences.

## Your Process

1. **FIRST MESSAGE**: When the user starts a new conversation (their first message), you MUST use the askUserQuestion tool to ask about their preferences. Ask 2-4 questions at once to gather information about:
   - **Color mood**: Dark/light, warm/cool, vibrant/muted
   - **Industry/context**: Tech, creative, corporate, education, etc.
   - **Font style**: Modern, classic, playful, minimalist, bold
   - **Overall vibe**: Professional, friendly, elegant, edgy, etc.

2. **AFTER ANSWERS**: Once you have the user's answers, generate the perfect theme based on their preferences. Return ONLY valid JSON (no markdown fences) with this exact structure:

\`\`\`json
{
  "name": "Theme Name (2-3 words, evocative)",
  "description": "A brief description of the theme's personality",
  "colors": {
    "background": "#hex",
    "foreground": "#hex",
    "accent": "#hex",
    "accentForeground": "#hex",
    "muted": "#hex",
    "mutedForeground": "#hex",
    "surface": "#hex",
    "surfaceForeground": "#hex",
    "border": "#hex"
  },
  "fonts": {
    "display": "Google Font Name for headings",
    "body": "Google Font Name for body text"
  },
  "spacing": "compact" | "balanced" | "spacious",
  "layoutStyle": "centered" | "split-panel" | "asymmetric" | "editorial" | "grid" | "terminal",
  "previewHtml": "<full self-contained HTML document showing a single sample slide>"
}
\`\`\`

## Design Principles
- Colors must have sufficient contrast (WCAG AA minimum)
- Font pairs should complement each other (display = distinctive, body = readable)
- Use Google Fonts only (widely available)
- The previewHtml must be a complete <!DOCTYPE html> document with embedded CSS
- The preview should show a realistic slide with title, subtitle, body text, and accent element
- Make themes distinctive and bold — avoid generic palettes
- Dark themes: background truly dark (#0a-#1a range), text light
- Light themes: background light (#f0-#ff range), text dark
- Accent colors should POP against the background

## Question Guidelines
When using askUserQuestion:
- Keep questions concise and engaging
- Provide 3-5 clear options per question
- Include brief descriptions for each option
- Make options mutually exclusive (not multiSelect) unless explicitly needed

Remember: ALWAYS use askUserQuestion on the first interaction to gather preferences!`;

// Helper to detect theme JSON in response
function detectThemeJson(content: string): boolean {
  const jsonMatch = content.match(/\{[\s\S]*"colors"[\s\S]*"fonts"[\s\S]*\}/);
  return jsonMatch !== null;
}

// Helper to extract and parse theme JSON
function extractThemeJson(content: string): {
  name: string;
  description?: string;
  colors: {
    background: string;
    foreground: string;
    accent: string;
    accentForeground: string;
    muted: string;
    mutedForeground: string;
    surface: string;
    surfaceForeground: string;
    border: string;
  };
  fonts: { display: string; body: string };
  spacing: "compact" | "balanced" | "spacious";
  layoutStyle?: string;
  previewHtml?: string;
} | null {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

// Build history for theme chat (simpler than presentations)
function buildThemeChatHistory(
  msgs: {
    _id: string;
    role: "user" | "assistant";
    content: string;
    isStreaming: boolean;
    toolCallId?: string;
    toolCallInput?: string;
    toolResultFor?: string;
  }[],
  provider: Provider,
): ModelMessage[] {
  const preserveToolParts = provider !== "google";

  return msgs.map((m): ModelMessage => {
    // Assistant message with tool call
    if (m.toolCallId && m.toolCallInput) {
      if (!preserveToolParts) {
        let toolContext = "";
        try {
          const parsed = JSON.parse(m.toolCallInput) as { questions?: Array<{ header?: string; question?: string }> };
          const questions = parsed.questions ?? [];
          if (questions.length > 0) {
            toolContext = questions
              .map((q, i) => `Q${i + 1}: ${q.header ? `${q.header} — ` : ""}${q.question ?? ""}`)
              .join("\n");
          }
        } catch {
          // Keep fallback text below
        }
        const text = [
          m.content,
          toolContext ? `\n[Previous questionnaire shown to user]\n${toolContext}` : "\n[Previous questionnaire shown to user]",
        ]
          .filter(Boolean)
          .join("\n");
        return { role: "assistant", content: text };
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parts: any[] = [];
        if (m.content) parts.push({ type: "text", text: m.content });
        parts.push({
          type: "tool-call",
          toolCallId: m.toolCallId,
          toolName: "askUserQuestion",
          input: JSON.parse(m.toolCallInput),
        });
        return { role: "assistant", content: parts };
      } catch {
        // Malformed — fall through
      }
    }

    // Tool result message
    if (m.toolResultFor) {
      if (!preserveToolParts) {
        return {
          role: "user",
          content: `[Questionnaire answers]\n${m.content}`,
        };
      }

      return {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: m.toolResultFor,
            toolName: "askUserQuestion",
            output: { type: "text", value: m.content },
          },
        ],
      };
    }

    // Plain message
    return { role: m.role, content: m.content };
  });
}

// Streaming logic for theme chat
async function runThemeChatStreaming(
  ctx: GenericActionCtx<DataModel>,
  history: ModelMessage[],
  assistantMsgId: Id<"themeMessages">,
  conversationId: Id<"themeConversations">,
  userAIConfig: UserAIConfig,
): Promise<void> {
  const model = createModel(userAIConfig);

  let fullContent = "";
  let textBuffer = "";
  let toolCallDetected: {
    id: string;
    name: string;
    input: unknown;
  } | null = null;

  const flushText = async () => {
    if (!textBuffer) return;
    await ctx.runMutation(internal.themeConversations.appendStream, {
      messageId: assistantMsgId,
      chunk: textBuffer,
    });
    textBuffer = "";
  };

  const result = streamText({
    model,
    system: THEME_CHAT_SYSTEM_PROMPT,
    messages: history,
    tools: { askUserQuestion: ASK_USER_QUESTION_TOOL },
    maxOutputTokens: 10000,
  });

  for await (const chunk of result.fullStream) {
    if (chunk.type === "text-delta") {
      const text = chunk.text;
      fullContent += text;
      textBuffer += text;
      if (textBuffer.length >= 1000) {
        await flushText();
      }
    } else if (chunk.type === "tool-call") {
      toolCallDetected = {
        id: chunk.toolCallId,
        name: chunk.toolName,
        input: chunk.input,
      };
    }
  }

  // Flush remaining text
  await flushText();

  if (toolCallDetected) {
    // Model called askUserQuestion — save and pause
    await ctx.runMutation(internal.themeConversations.saveToolCall, {
      messageId: assistantMsgId,
      toolCallId: toolCallDetected.id,
      toolCallInput: JSON.stringify(toolCallDetected.input),
    });
  } else {
    // Check if response contains theme JSON  
    const hasThemeResult = detectThemeJson(fullContent);
    await ctx.runMutation(internal.themeConversations.finalize, {
      messageId: assistantMsgId,
      hasThemeResult,
    });

    // If theme was generated, save it
    if (hasThemeResult) {
      const themeData = extractThemeJson(fullContent);
      if (themeData) {
        const themeId = await ctx.runMutation(api.themes.create, {
          name: themeData.name,
          description: themeData.description,
          colors: themeData.colors,
          fonts: themeData.fonts,
          spacing: themeData.spacing,
          layoutStyle: themeData.layoutStyle,
          previewHtml: themeData.previewHtml,
        });
        await ctx.runMutation(internal.themeConversations.setGeneratedTheme, {
          conversationId,
          themeId,
        });
      }
    }
  }
}

export const sendThemeMessage = action({
  args: {
    conversationId: v.id("themeConversations"),
    userContent: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // 1. Auth check
    const userId = await ctx.runQuery(internal.users.currentUserId);
    if (!userId) throw new Error("Not authenticated");

    // 2. Save user message
    await ctx.runMutation(api.themeConversations.addUserMessage, {
      conversationId: args.conversationId,
      content: args.userContent,
    });

    // 3. Create empty assistant message
    const assistantMsgId = await ctx.runMutation(
      internal.themeConversations.createAssistantMessage,
      { conversationId: args.conversationId },
    );

    // 4. Resolve user AI config
    const aiConfig = await ctx.runQuery(internal.users.getAIConfig, { userId });
    const userAIConfig: UserAIConfig = {
      provider: aiConfig.selectedProvider ?? "anthropic",
      model: aiConfig.selectedModel ?? "claude-sonnet-4-6",
      anthropicApiKey: aiConfig.anthropicApiKey,
      openaiApiKey: aiConfig.openaiApiKey,
      googleApiKey: aiConfig.googleApiKey,
    };

    // 5. Load conversation history
    const rawHistory = await ctx.runQuery(internal.themeConversations.listForAI, {
      conversationId: args.conversationId,
    });
    const history = buildThemeChatHistory(rawHistory, userAIConfig.provider);

    // 6. Stream AI response
    try {
      await runThemeChatStreaming(
        ctx,
        history,
        assistantMsgId,
        args.conversationId,
        userAIConfig,
      );
    } catch (error) {
      await ctx.runMutation(internal.themeConversations.appendStream, {
        messageId: assistantMsgId,
        chunk: formatAIError(error, userAIConfig.provider),
      });
      await ctx.runMutation(internal.themeConversations.finalize, {
        messageId: assistantMsgId,
        hasThemeResult: false,
      });
    }

    return null;
  },
});

export const answerThemeQuestion = action({
  args: {
    conversationId: v.id("themeConversations"),
    toolCallId: v.string(),
    answers: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // 1. Auth check
    const userId = await ctx.runQuery(internal.users.currentUserId);
    if (!userId) throw new Error("Not authenticated");

    // 2. Save tool result message
    await ctx.runMutation(internal.themeConversations.saveToolResult, {
      conversationId: args.conversationId,
      toolCallId: args.toolCallId,
      content: args.answers,
    });

    // 3. Create empty assistant message
    const assistantMsgId = await ctx.runMutation(
      internal.themeConversations.createAssistantMessage,
      { conversationId: args.conversationId },
    );

    // 4. Resolve user AI config
    const aiConfig = await ctx.runQuery(internal.users.getAIConfig, { userId });
    const userAIConfig: UserAIConfig = {
      provider: aiConfig.selectedProvider ?? "anthropic",
      model: aiConfig.selectedModel ?? "claude-sonnet-4-6",
      anthropicApiKey: aiConfig.anthropicApiKey,
      openaiApiKey: aiConfig.openaiApiKey,
      googleApiKey: aiConfig.googleApiKey,
    };

    // 5. Load full conversation history
    const rawHistory = await ctx.runQuery(internal.themeConversations.listForAI, {
      conversationId: args.conversationId,
    });
    const history = buildThemeChatHistory(rawHistory, userAIConfig.provider);

    // 6. Continue streaming
    try {
      await runThemeChatStreaming(
        ctx,
        history,
        assistantMsgId,
        args.conversationId,
        userAIConfig,
      );
    } catch (error) {
      await ctx.runMutation(internal.themeConversations.appendStream, {
        messageId: assistantMsgId,
        chunk: formatAIError(error, userAIConfig.provider),
      });
      await ctx.runMutation(internal.themeConversations.finalize, {
        messageId: assistantMsgId,
        hasThemeResult: false,
      });
    }

    return null;
  },
});
