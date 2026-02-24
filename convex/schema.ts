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
    // Tool use fields (optional — only set when Claude calls AskUserQuestion)
    toolCallId: v.optional(v.string()),      // Anthropic tool_use id
    toolCallInput: v.optional(v.string()),   // JSON of the questions array
    toolResultFor: v.optional(v.string()),   // tool_use_id this row answers
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
