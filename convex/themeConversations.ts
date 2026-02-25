import {
  mutation,
  query,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ─── Conversations ───────────────────────────────────────────────────────────

export const create = mutation({
  args: {},
  returns: v.id("themeConversations"),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db.insert("themeConversations", {
      userId,
      status: "active",
      createdAt: Date.now(),
    });
  },
});

export const get = query({
  args: { conversationId: v.id("themeConversations") },
  returns: v.union(
    v.object({
      _id: v.id("themeConversations"),
      _creationTime: v.number(),
      userId: v.id("users"),
      status: v.union(v.literal("active"), v.literal("completed")),
      createdAt: v.number(),
      generatedThemeId: v.optional(v.id("themes")),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.userId !== userId) return null;
    return conv;
  },
});

export const setGeneratedTheme = internalMutation({
  args: {
    conversationId: v.id("themeConversations"),
    themeId: v.id("themes"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.conversationId, {
      generatedThemeId: args.themeId,
      status: "completed",
    });
    return null;
  },
});

// ─── Messages ────────────────────────────────────────────────────────────────

const messageReturnValidator = v.object({
  _id: v.id("themeMessages"),
  _creationTime: v.number(),
  conversationId: v.id("themeConversations"),
  role: v.union(v.literal("user"), v.literal("assistant")),
  content: v.string(),
  isStreaming: v.boolean(),
  hasThemeResult: v.boolean(),
  createdAt: v.number(),
  toolCallId: v.optional(v.string()),
  toolCallInput: v.optional(v.string()),
  toolResultFor: v.optional(v.string()),
});

export const listMessages = query({
  args: { conversationId: v.id("themeConversations") },
  returns: v.array(messageReturnValidator),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.userId !== userId) return [];
    return await ctx.db
      .query("themeMessages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();
  },
});

export const addUserMessage = mutation({
  args: {
    conversationId: v.id("themeConversations"),
    content: v.string(),
  },
  returns: v.id("themeMessages"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.userId !== userId) throw new Error("Not found");
    return await ctx.db.insert("themeMessages", {
      conversationId: args.conversationId,
      role: "user",
      content: args.content,
      isStreaming: false,
      hasThemeResult: false,
      createdAt: Date.now(),
    });
  },
});

export const createAssistantMessage = internalMutation({
  args: { conversationId: v.id("themeConversations") },
  returns: v.id("themeMessages"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("themeMessages", {
      conversationId: args.conversationId,
      role: "assistant",
      content: "",
      isStreaming: true,
      hasThemeResult: false,
      createdAt: Date.now(),
    });
  },
});

export const appendStream = internalMutation({
  args: {
    messageId: v.id("themeMessages"),
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
    messageId: v.id("themeMessages"),
    hasThemeResult: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      isStreaming: false,
      hasThemeResult: args.hasThemeResult,
    });
    return null;
  },
});

export const listForAI = internalQuery({
  args: { conversationId: v.id("themeConversations") },
  returns: v.array(
    v.object({
      _id: v.id("themeMessages"),
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
      .query("themeMessages")
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
    messageId: v.id("themeMessages"),
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
    conversationId: v.id("themeConversations"),
    toolCallId: v.string(),
    content: v.string(),
  },
  returns: v.id("themeMessages"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("themeMessages", {
      conversationId: args.conversationId,
      role: "user",
      content: args.content,
      isStreaming: false,
      hasThemeResult: false,
      createdAt: Date.now(),
      toolResultFor: args.toolCallId,
    });
  },
});
