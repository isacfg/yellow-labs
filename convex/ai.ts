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
import { SYSTEM_PROMPT } from "./skill/content";

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
  attachmentImages?: { data: string; mediaType: string }[],
  attachmentMessageId?: string,
  attachmentText?: string,
): ModelMessage[] {
  return msgs.map((m): ModelMessage => {
    // Assistant message with tool call
    if (m.toolCallId && m.toolCallInput) {
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

// ─── Shared streaming logic ───────────────────────────────────────────────────

async function runStreaming(
  ctx: GenericActionCtx<DataModel>,
  history: ModelMessage[],
  assistantMsgId: Id<"messages">,
  conversationId: Id<"conversations">,
  userId: Id<"users">,
  convTitle: string | undefined,
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
    await ctx.runMutation(internal.messages.appendStream, {
      messageId: assistantMsgId,
      chunk: textBuffer,
    });
    textBuffer = "";
  };

  const result = streamText({
    model,
    system: SYSTEM_PROMPT,
    messages: history,
    tools: { askUserQuestion: ASK_USER_QUESTION_TOOL },
    maxOutputTokens: 16000,
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
    // Model called askUserQuestion — save tool call and pause
    await ctx.runMutation(internal.messages.saveToolCall, {
      messageId: assistantMsgId,
      toolCallId: toolCallDetected.id,
      toolCallInput: JSON.stringify(toolCallDetected.input),
    });
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

    // 4. Load conversation history
    const rawHistory = await ctx.runQuery(internal.messages.listForAI, {
      conversationId: args.conversationId,
    });
    const history = buildHistory(
      rawHistory,
      args.attachmentImages,
      savedMsgId,
      args.attachmentText,
    );

    // 5. Create empty assistant message
    const assistantMsgId = await ctx.runMutation(
      internal.messages.createAssistant,
      { conversationId: args.conversationId },
    );

    // 6. Resolve user AI config
    const aiConfig = await ctx.runQuery(internal.users.getAIConfig, { userId });
    const userAIConfig: UserAIConfig = {
      provider: aiConfig.selectedProvider ?? "anthropic",
      model: aiConfig.selectedModel ?? "claude-sonnet-4-6",
      anthropicApiKey: aiConfig.anthropicApiKey,
      openaiApiKey: aiConfig.openaiApiKey,
      googleApiKey: aiConfig.googleApiKey,
    };

    // 7. Stream AI response
    await runStreaming(
      ctx,
      history,
      assistantMsgId,
      args.conversationId,
      userId,
      conv?.title,
      userAIConfig,
    );

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

    // 3. Load full conversation history (now includes the tool result)
    const rawHistory = await ctx.runQuery(internal.messages.listForAI, {
      conversationId: args.conversationId,
    });
    const history = buildHistory(rawHistory);

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

    // 6. Continue streaming
    const conv = await ctx.runQuery(api.conversations.get, {
      conversationId: args.conversationId,
    });
    await runStreaming(
      ctx,
      history,
      assistantMsgId,
      args.conversationId,
      userId,
      conv?.title,
      userAIConfig,
    );

    return null;
  },
});
