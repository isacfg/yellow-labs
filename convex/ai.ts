"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./skill/content";

function detectStylePreviews(content: string): boolean {
  // Detect 3 HTML code blocks (the skill generates 3 preview options)
  const htmlBlocks = content.match(/```html[\s\S]*?```/g);
  return htmlBlocks !== null && htmlBlocks.length >= 3;
}

function detectFinalPresentation(content: string): boolean {
  // Detect a single large HTML document (> 5000 chars) with DOCTYPE
  const doctypeMatch = content.match(/<!DOCTYPE html>[\s\S]*/i);
  if (!doctypeMatch) return false;
  // Must be a substantial document
  return doctypeMatch[0].length > 5000;
}

function extractTitle(htmlContent: string, fallback: string): string {
  const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : fallback;
}

function generateSlug(): string {
  return crypto.randomUUID();
}

export const sendMessage = action({
  args: {
    conversationId: v.id("conversations"),
    userContent: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // 1. Auth check
    const userId = await ctx.runQuery(api.users.getAuthUserId);
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
    const history = await ctx.runQuery(internal.messages.listForAI, {
      conversationId: args.conversationId,
    });

    // 5. Create empty assistant message
    const assistantMsgId = await ctx.runMutation(
      internal.messages.createAssistant,
      { conversationId: args.conversationId }
    );

    // 6. Call Anthropic with streaming
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    let fullContent = "";

    const stream = await client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: history,
    });

    // 7. Stream chunks to DB
    for await (const chunk of stream) {
      if (
        chunk.type === "content_block_delta" &&
        chunk.delta.type === "text_delta"
      ) {
        const text = chunk.delta.text;
        fullContent += text;
        await ctx.runMutation(internal.messages.appendStream, {
          messageId: assistantMsgId,
          chunk: text,
        });
      }
    }

    // 8. Detect content type and finalize
    const hasStylePreviews = detectStylePreviews(fullContent);
    const hasFinalPresentation = detectFinalPresentation(fullContent);

    await ctx.runMutation(internal.messages.finalize, {
      messageId: assistantMsgId,
      hasStylePreviews,
      hasFinalPresentation,
    });

    // 9. Save presentation if final HTML detected
    if (hasFinalPresentation) {
      const htmlMatch = fullContent.match(/<!DOCTYPE html>[\s\S]*/i);
      const htmlContent = htmlMatch ? htmlMatch[0] : fullContent;
      const title = extractTitle(htmlContent, conv?.title ?? "Presentation");
      const slug = generateSlug();

      await ctx.runMutation(internal.presentations.save, {
        userId,
        conversationId: args.conversationId,
        title,
        htmlContent,
        slug,
      });
    }

    return null;
  },
});
