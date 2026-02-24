import {
  mutation,
  query,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: { conversationId: v.id("conversations") },
  returns: v.array(
    v.object({
      _id: v.id("messages"),
      _creationTime: v.number(),
      conversationId: v.id("conversations"),
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
      isStreaming: v.boolean(),
      hasStylePreviews: v.boolean(),
      hasFinalPresentation: v.boolean(),
      createdAt: v.number(),
      toolCallId: v.optional(v.string()),
      toolCallInput: v.optional(v.string()),
      toolResultFor: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.userId !== userId) return [];
    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();
  },
});

export const addUser = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
  },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.userId !== userId) throw new Error("Not found");
    return await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: "user",
      content: args.content,
      isStreaming: false,
      hasStylePreviews: false,
      hasFinalPresentation: false,
      createdAt: Date.now(),
    });
  },
});

export const createAssistant = internalMutation({
  args: { conversationId: v.id("conversations") },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: "assistant",
      content: "",
      isStreaming: true,
      hasStylePreviews: false,
      hasFinalPresentation: false,
      createdAt: Date.now(),
    });
  },
});

export const appendStream = internalMutation({
  args: {
    messageId: v.id("messages"),
    chunk: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("Message not found");
    await ctx.db.patch(args.messageId, {
      content: msg.content + args.chunk,
    });
    return null;
  },
});

export const finalize = internalMutation({
  args: {
    messageId: v.id("messages"),
    hasStylePreviews: v.boolean(),
    hasFinalPresentation: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      isStreaming: false,
      hasStylePreviews: args.hasStylePreviews,
      hasFinalPresentation: args.hasFinalPresentation,
    });
    return null;
  },
});

export const listForAI = internalQuery({
  args: { conversationId: v.id("conversations") },
  returns: v.array(
    v.object({
      _id: v.id("messages"),
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
      isStreaming: v.boolean(),
      toolCallId: v.optional(v.string()),
      toolCallInput: v.optional(v.string()),
      toolResultFor: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();
    return msgs
      .filter((m) => !m.isStreaming || m.content.length > 0)
      .map((m) => ({
        _id: m._id,
        role: m.role,
        content: m.content,
        isStreaming: m.isStreaming,
        toolCallId: m.toolCallId,
        toolCallInput: m.toolCallInput,
        toolResultFor: m.toolResultFor,
      }));
  },
});

export const saveToolCall = internalMutation({
  args: {
    messageId: v.id("messages"),
    toolCallId: v.string(),
    toolCallInput: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      toolCallId: args.toolCallId,
      toolCallInput: args.toolCallInput,
      isStreaming: false,
    });
    return null;
  },
});

export const saveToolResult = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    toolCallId: v.string(),
    content: v.string(),
  },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: "user",
      content: args.content,
      isStreaming: false,
      hasStylePreviews: false,
      hasFinalPresentation: false,
      createdAt: Date.now(),
      toolResultFor: args.toolCallId,
    });
  },
});
