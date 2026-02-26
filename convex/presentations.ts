import {
  query,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { applyOperations, type EditOperation } from "./editEngine";

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
      themeId: v.optional(v.id("themes")),
      parentId: v.optional(v.id("presentations")),
      version: v.optional(v.number()),
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
      themeId: v.optional(v.id("themes")),
      parentId: v.optional(v.id("presentations")),
      version: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const result = await ctx.db
      .query("presentations")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("desc")
      .first();
    return result ?? null;
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

// ─── Smart Edits ──────────────────────────────────────────────────────────────

const editOperationValidator = v.union(
  v.object({ type: v.literal("searchReplace"), search: v.string(), replace: v.string() }),
  v.object({ type: v.literal("replaceSlide"), slideIndex: v.number(), newHtml: v.string() }),
  v.object({ type: v.literal("insertSlide"), afterIndex: v.number(), html: v.string() }),
  v.object({ type: v.literal("deleteSlide"), slideIndex: v.number() }),
);

export const applyEdits = internalMutation({
  args: {
    presentationId: v.id("presentations"),
    operations: v.array(editOperationValidator),
    conversationId: v.id("conversations"),
    userId: v.id("users"),
  },
  returns: v.id("presentations"),
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.presentationId);
    if (!current) throw new Error("Presentation not found");

    // Compute the current version number
    const version = (current.version ?? 1) + 1;

    // Apply edit operations to the HTML
    const newHtml = applyOperations(
      current.htmlContent,
      args.operations as EditOperation[],
    );

    // Re-extract title in case it changed
    const titleMatch = newHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : current.title;

    // Generate new slug for this version
    const slug = crypto.randomUUID();

    // Insert as a new versioned row
    return await ctx.db.insert("presentations", {
      userId: args.userId,
      conversationId: args.conversationId,
      title,
      htmlContent: newHtml,
      slug,
      createdAt: Date.now(),
      themeId: current.themeId,
      parentId: args.presentationId,
      version,
    });
  },
});

export const getLatestByConversation = internalQuery({
  args: { conversationId: v.id("conversations") },
  returns: v.union(
    v.object({
      _id: v.id("presentations"),
      htmlContent: v.string(),
      title: v.string(),
      version: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("presentations")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("desc")
      .first();
    if (!results) return null;
    return {
      _id: results._id,
      htmlContent: results.htmlContent,
      title: results.title,
      version: results.version,
    };
  },
});

export const getVersionHistory = query({
  args: { conversationId: v.id("conversations") },
  returns: v.array(
    v.object({
      _id: v.id("presentations"),
      title: v.string(),
      slug: v.string(),
      version: v.optional(v.number()),
      parentId: v.optional(v.id("presentations")),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const results = await ctx.db
      .query("presentations")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("desc")
      .collect();
    return results.map((p) => ({
      _id: p._id,
      title: p.title,
      slug: p.slug,
      version: p.version,
      parentId: p.parentId,
      createdAt: p.createdAt,
    }));
  },
});
