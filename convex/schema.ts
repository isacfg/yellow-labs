import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  // Extend the users table from authTables with our custom field
  users: defineTable({
    // Fields from authTables.users:
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // Custom field for profile photo storage:
    profileImageId: v.optional(v.id("_storage")),
    // AI provider settings
    selectedProvider: v.optional(v.union(
      v.literal("anthropic"),
      v.literal("openai"),
      v.literal("google"),
    )),
    selectedModel: v.optional(v.string()),
    anthropicApiKey: v.optional(v.string()),
    openaiApiKey: v.optional(v.string()),
    googleApiKey: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  conversations: defineTable({
    userId: v.id("users"),
    title: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("completed")),
    createdAt: v.number(),
    themeId: v.optional(v.id("themes")),
  }).index("by_user", ["userId"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    isStreaming: v.boolean(),
    hasStylePreviews: v.boolean(),
    hasFinalPresentation: v.boolean(),
    createdAt: v.number(),
    // Attachment metadata (optional — only set when user attaches a file)
    hasAttachment: v.optional(v.boolean()),
    attachmentName: v.optional(v.string()),
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
    themeId: v.optional(v.id("themes")),
  })
    .index("by_user", ["userId"])
    .index("by_slug", ["slug"]),

  themes: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    colors: v.object({
      background: v.string(),
      foreground: v.string(),
      accent: v.string(),
      accentForeground: v.string(),
      muted: v.string(),
      mutedForeground: v.string(),
      surface: v.string(),
      surfaceForeground: v.string(),
      border: v.string(),
    }),
    fonts: v.object({
      display: v.string(),
      body: v.string(),
    }),
    spacing: v.union(
      v.literal("compact"),
      v.literal("balanced"),
      v.literal("spacious"),
    ),
    layoutStyle: v.optional(v.string()),
    cssVariables: v.string(),
    previewHtml: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // Theme conversations for interactive theme creation
  themeConversations: defineTable({
    userId: v.id("users"),
    status: v.union(v.literal("active"), v.literal("completed")),
    createdAt: v.number(),
    generatedThemeId: v.optional(v.id("themes")),
  }).index("by_user", ["userId"]),

  themeMessages: defineTable({
    conversationId: v.id("themeConversations"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    isStreaming: v.boolean(),
    hasThemeResult: v.boolean(),
    createdAt: v.number(),
    // Tool use fields (optional — for askUserQuestion tool)
    toolCallId: v.optional(v.string()),
    toolCallInput: v.optional(v.string()),
    toolResultFor: v.optional(v.string()),
  }).index("by_conversation", ["conversationId"]),
});
