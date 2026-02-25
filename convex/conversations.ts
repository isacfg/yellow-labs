import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const create = mutation({
  args: {},
  returns: v.id("conversations"),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db.insert("conversations", {
      userId,
      status: "active",
      createdAt: Date.now(),
    });
  },
});

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("conversations"),
      _creationTime: v.number(),
      userId: v.id("users"),
      title: v.optional(v.string()),
      status: v.union(v.literal("active"), v.literal("completed")),
      createdAt: v.number(),
      themeId: v.optional(v.id("themes")),
    })
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { conversationId: v.id("conversations") },
  returns: v.union(
    v.object({
      _id: v.id("conversations"),
      _creationTime: v.number(),
      userId: v.id("users"),
      title: v.optional(v.string()),
      status: v.union(v.literal("active"), v.literal("completed")),
      createdAt: v.number(),
      themeId: v.optional(v.id("themes")),
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

export const setTitle = mutation({
  args: {
    conversationId: v.id("conversations"),
    title: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(args.conversationId, { title: args.title });
    return null;
  },
});

export const setTheme = mutation({
  args: {
    conversationId: v.id("conversations"),
    themeId: v.optional(v.id("themes")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(args.conversationId, { themeId: args.themeId });
    return null;
  },
});
