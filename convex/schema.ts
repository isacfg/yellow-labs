import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  conversations: defineTable({
    userId: v.id("users"),
    title: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("completed")),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    isStreaming: v.boolean(),
    hasStylePreviews: v.boolean(),
    hasFinalPresentation: v.boolean(),
    createdAt: v.number(),
  }).index("by_conversation", ["conversationId"]),

  presentations: defineTable({
    userId: v.id("users"),
    conversationId: v.id("conversations"),
    title: v.string(),
    htmlContent: v.string(),
    slug: v.string(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_slug", ["slug"]),
});
