"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import Anthropic from "@anthropic-ai/sdk";
import type { GenericActionCtx } from "convex/server";
import type { DataModel } from "./_generated/dataModel";
import type { Id } from "./_generated/dataModel";
import { SYSTEM_PROMPT } from "./skill/content";

// ─── Tool definition ────────────────────────────────────────────────────────

const ASK_USER_QUESTION_TOOL: Anthropic.Tool = {
  name: "AskUserQuestion",
  description:
    "Ask the user one or more multiple-choice questions. Use this to collect preferences, goals, or decisions before generating content.",
  input_schema: {
    type: "object" as const,
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            header: {
              type: "string",
              description: "Short label for this question (max 12 chars), e.g. 'Purpose'",
            },
            question: {
              type: "string",
              description: "The full question text",
            },
            options: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  description: { type: "string" },
                },
                required: ["label", "description"],
              },
            },
            multiSelect: {
              type: "boolean",
              description: "Whether the user can select multiple options",
            },
          },
          required: ["header", "question", "options"],
        },
      },
    },
    required: ["questions"],
  },
};

// ─── History builder ────────────────────────────────────────────────────────

type RawMessage = {
  role: "user" | "assistant";
  content: string;
  isStreaming: boolean;
  toolCallId?: string;
  toolCallInput?: string;
  toolResultFor?: string;
};

function buildHistory(msgs: RawMessage[]): Anthropic.MessageParam[] {
  return msgs.map((m) => {
    if (m.toolCallId && m.toolCallInput) {
      // Assistant message that called AskUserQuestion
      const content: Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam> = [];
      if (m.content) {
        content.push({ type: "text", text: m.content });
      }
      content.push({
        type: "tool_use",
        id: m.toolCallId,
        name: "AskUserQuestion",
        input: JSON.parse(m.toolCallInput) as Record<string, unknown>,
      });
      return { role: "assistant" as const, content };
    }
    if (m.toolResultFor) {
      // Hidden user message containing the tool result
      return {
        role: "user" as const,
        content: [
          {
            type: "tool_result" as const,
            tool_use_id: m.toolResultFor,
            content: m.content,
          },
        ],
      };
    }
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
  client: Anthropic,
  history: Anthropic.MessageParam[],
  assistantMsgId: Id<"messages">,
  conversationId: Id<"conversations">,
  userId: Id<"users">,
  convTitle: string | undefined,
): Promise<void> {
  let fullContent = "";
  let toolUseId = "";
  let toolUseName = "";
  let toolInputJson = "";
  let isCollectingTool = false;

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: history,
    tools: [ASK_USER_QUESTION_TOOL],
  });

  for await (const chunk of stream) {
    if (chunk.type === "content_block_start") {
      if (chunk.content_block.type === "tool_use") {
        isCollectingTool = true;
        toolUseId = chunk.content_block.id;
        toolUseName = chunk.content_block.name;
        toolInputJson = "";
      }
    } else if (chunk.type === "content_block_delta") {
      if (chunk.delta.type === "text_delta") {
        const text = chunk.delta.text;
        fullContent += text;
        await ctx.runMutation(internal.messages.appendStream, {
          messageId: assistantMsgId,
          chunk: text,
        });
      } else if (chunk.delta.type === "input_json_delta") {
        toolInputJson += chunk.delta.partial_json;
      }
    } else if (chunk.type === "content_block_stop") {
      if (isCollectingTool) {
        isCollectingTool = false;
      }
    }
  }

  if (toolUseId) {
    // Claude called AskUserQuestion — save tool call and pause
    await ctx.runMutation(internal.messages.saveToolCall, {
      messageId: assistantMsgId,
      toolCallId: toolUseId,
      toolCallInput: toolInputJson,
    });
    void toolUseName; // suppress unused-variable warning
  } else {
    // Normal text response — finalize
    const hasStylePreviews = detectStylePreviews(fullContent);
    const hasFinalPresentation = detectFinalPresentation(fullContent);
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
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // 1. Auth check
    const userId = await ctx.runQuery(internal.users.currentUserId);
    if (!userId) throw new Error("Not authenticated");

    // 2. Save user message
    await ctx.runMutation(api.messages.addUser, {
      conversationId: args.conversationId,
      content: args.userContent,
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
    const history = buildHistory(rawHistory);

    // 5. Create empty assistant message
    const assistantMsgId = await ctx.runMutation(
      internal.messages.createAssistant,
      { conversationId: args.conversationId }
    );

    // 6. Stream Claude response
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    await runStreaming(
      ctx,
      client,
      history,
      assistantMsgId,
      args.conversationId,
      userId,
      conv?.title,
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
      { conversationId: args.conversationId }
    );

    // 5. Continue streaming
    const conv = await ctx.runQuery(api.conversations.get, {
      conversationId: args.conversationId,
    });
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    await runStreaming(
      ctx,
      client,
      history,
      assistantMsgId,
      args.conversationId,
      userId,
      conv?.title,
    );

    return null;
  },
});
