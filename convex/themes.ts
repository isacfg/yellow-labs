import {
  query,
  mutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ─── Shared validators ───────────────────────────────────────────────────────

const colorsValidator = v.object({
  background: v.string(),
  foreground: v.string(),
  accent: v.string(),
  accentForeground: v.string(),
  muted: v.string(),
  mutedForeground: v.string(),
  surface: v.string(),
  surfaceForeground: v.string(),
  border: v.string(),
});

const fontsValidator = v.object({
  display: v.string(),
  body: v.string(),
});

const spacingValidator = v.union(
  v.literal("compact"),
  v.literal("balanced"),
  v.literal("spacious"),
);

const themeReturnValidator = v.object({
  _id: v.id("themes"),
  _creationTime: v.number(),
  userId: v.id("users"),
  name: v.string(),
  description: v.optional(v.string()),
  colors: colorsValidator,
  fonts: fontsValidator,
  spacing: spacingValidator,
  layoutStyle: v.optional(v.string()),
  cssVariables: v.string(),
  previewHtml: v.optional(v.string()),
  createdAt: v.number(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function compileCssVariables(
  colors: {
    background: string;
    foreground: string;
    accent: string;
    accentForeground: string;
    muted: string;
    mutedForeground: string;
    surface: string;
    surfaceForeground: string;
    border: string;
  },
  fonts: { display: string; body: string },
): string {
  return [
    `:root {`,
    `  --theme-bg: ${colors.background};`,
    `  --theme-fg: ${colors.foreground};`,
    `  --theme-accent: ${colors.accent};`,
    `  --theme-accent-fg: ${colors.accentForeground};`,
    `  --theme-muted: ${colors.muted};`,
    `  --theme-muted-fg: ${colors.mutedForeground};`,
    `  --theme-surface: ${colors.surface};`,
    `  --theme-surface-fg: ${colors.surfaceForeground};`,
    `  --theme-border: ${colors.border};`,
    `  --theme-font-display: "${fonts.display}", ui-sans-serif, system-ui, sans-serif;`,
    `  --theme-font-body: "${fonts.body}", ui-sans-serif, system-ui, sans-serif;`,
    `}`,
  ].join("\n");
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export const list = query({
  args: {},
  returns: v.array(themeReturnValidator),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("themes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { themeId: v.id("themes") },
  returns: v.union(themeReturnValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const theme = await ctx.db.get(args.themeId);
    if (!theme || theme.userId !== userId) return null;
    return theme;
  },
});

// Internal query for use in actions (no auth check — caller is trusted)
export const getInternal = internalQuery({
  args: { themeId: v.id("themes") },
  returns: v.union(themeReturnValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.themeId);
  },
});

// ─── Mutations ───────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    colors: colorsValidator,
    fonts: fontsValidator,
    spacing: spacingValidator,
    layoutStyle: v.optional(v.string()),
    previewHtml: v.optional(v.string()),
  },
  returns: v.id("themes"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const cssVariables = compileCssVariables(args.colors, args.fonts);

    return await ctx.db.insert("themes", {
      userId,
      name: args.name,
      description: args.description,
      colors: args.colors,
      fonts: args.fonts,
      spacing: args.spacing,
      layoutStyle: args.layoutStyle,
      cssVariables,
      previewHtml: args.previewHtml,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    themeId: v.id("themes"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    colors: v.optional(colorsValidator),
    fonts: v.optional(fontsValidator),
    spacing: v.optional(spacingValidator),
    layoutStyle: v.optional(v.string()),
    previewHtml: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const theme = await ctx.db.get(args.themeId);
    if (!theme || theme.userId !== userId) throw new Error("Theme not found");

    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.description !== undefined) patch.description = args.description;
    if (args.colors !== undefined) patch.colors = args.colors;
    if (args.fonts !== undefined) patch.fonts = args.fonts;
    if (args.spacing !== undefined) patch.spacing = args.spacing;
    if (args.layoutStyle !== undefined) patch.layoutStyle = args.layoutStyle;
    if (args.previewHtml !== undefined) patch.previewHtml = args.previewHtml;

    // Recompile CSS if colors or fonts changed
    const newColors = args.colors ?? theme.colors;
    const newFonts = args.fonts ?? theme.fonts;
    if (args.colors !== undefined || args.fonts !== undefined) {
      patch.cssVariables = compileCssVariables(newColors, newFonts);
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.themeId, patch);
    }
    return null;
  },
});

export const remove = mutation({
  args: { themeId: v.id("themes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const theme = await ctx.db.get(args.themeId);
    if (!theme || theme.userId !== userId) throw new Error("Theme not found");

    await ctx.db.delete(args.themeId);
    return null;
  },
});

export const duplicate = mutation({
  args: { themeId: v.id("themes") },
  returns: v.id("themes"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const theme = await ctx.db.get(args.themeId);
    if (!theme || theme.userId !== userId) throw new Error("Theme not found");

    return await ctx.db.insert("themes", {
      userId,
      name: `Copy of ${theme.name}`,
      description: theme.description,
      colors: theme.colors,
      fonts: theme.fonts,
      spacing: theme.spacing,
      layoutStyle: theme.layoutStyle,
      cssVariables: theme.cssVariables,
      previewHtml: theme.previewHtml,
      createdAt: Date.now(),
    });
  },
});
