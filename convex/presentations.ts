import {
  query,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("presentations"),
      _creationTime: v.number(),
      userId: v.id("users"),
      conversationId: v.id("conversations"),
      title: v.string(),
      slug: v.string(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const presentations = await ctx.db
      .query("presentations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    return presentations.map((p) => ({
      _id: p._id,
      _creationTime: p._creationTime,
      userId: p.userId,
      conversationId: p.conversationId,
      title: p.title,
      slug: p.slug,
      createdAt: p.createdAt,
    }));
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("presentations"),
      _creationTime: v.number(),
      userId: v.id("users"),
      conversationId: v.id("conversations"),
      title: v.string(),
      htmlContent: v.string(),
      slug: v.string(),
      createdAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("presentations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});

export const getByConversation = query({
  args: { conversationId: v.id("conversations") },
  returns: v.union(
    v.object({
      _id: v.id("presentations"),
      _creationTime: v.number(),
      userId: v.id("users"),
      conversationId: v.id("conversations"),
      title: v.string(),
      htmlContent: v.string(),
      slug: v.string(),
      createdAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const results = await ctx.db
      .query("presentations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    return (
      results.find((p) => p.conversationId === args.conversationId) ?? null
    );
  },
});

export const save = internalMutation({
  args: {
    userId: v.id("users"),
    conversationId: v.id("conversations"),
    title: v.string(),
    htmlContent: v.string(),
    slug: v.string(),
    themeId: v.optional(v.id("themes")),
  },
  returns: v.id("presentations"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("presentations", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
