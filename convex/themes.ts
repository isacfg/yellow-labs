import {
  query,
  mutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { findSlides } from "./editEngine";

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
  previewSlideHtml: v.optional(v.string()),
  presentationCss: v.optional(v.string()),
  previewImageId: v.optional(v.id("_storage")),
  createdAt: v.number(),
});

type ThemeColors = {
  background: string;
  foreground: string;
  accent: string;
  accentForeground: string;
  muted: string;
  mutedForeground: string;
  surface: string;
  surfaceForeground: string;
  border: string;
};

type ThemeFonts = {
  display: string;
  body: string;
};

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

// ─── Presentation style extraction ──────────────────────────────────────────

/** Extract and concatenate all <style> blocks from a presentation HTML. */
function extractFullCss(html: string): string {
  const blocks: string[] = [];
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    const css = m[1].trim();
    if (css) blocks.push(css);
  }
  return blocks.join("\n\n");
}

/**
 * Build a self-contained first-slide HTML document from a full presentation.
 * Preserves all font imports, CSS, and the raw HTML of the first slide section.
 */
function buildFirstSlideDocument(html: string): string {
  const slides = findSlides(html);
  if (slides.length === 0) return "";

  const { startOffset, endOffset } = slides[0];
  const slideHtml = html.slice(startOffset, endOffset);

  // Preserve Google Fonts / external font links
  const fontLinks: string[] = [];
  for (const m of html.matchAll(/<link[^>]+href="[^"]*fonts[^"]*"[^>]*>/gi)) {
    fontLinks.push(m[0]);
  }

  const fullCss = extractFullCss(html);

  return [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="UTF-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    ...fontLinks.map((l) => `  ${l}`),
    "  <style>",
    `    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }`,
    `    ${fullCss.replace(/\n/g, "\n    ")}`,
    "  </style>",
    "</head>",
    "<body>",
    `  ${slideHtml}`,
    "</body>",
    "</html>",
  ].join("\n");
}

function normalizeFontName(value: string | undefined): string | null {
  if (!value) return null;
  const cleaned = value
    .replace(/!important/g, "")
    .split(",")[0]
    .replace(/["']/g, "")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

function parseCssVariables(html: string): Map<string, string> {
  const map = new Map<string, string>();
  const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)];

  for (const [, css] of styleBlocks) {
    const rootBlocks = [...css.matchAll(/:root\s*\{([\s\S]*?)\}/gi)];
    for (const [, rootBody] of rootBlocks) {
      for (const match of rootBody.matchAll(/--([a-zA-Z0-9-_]+)\s*:\s*([^;]+);/g)) {
        map.set(`--${match[1]}`, match[2].trim());
      }
    }
  }

  return map;
}

function resolveCssVarValue(
  cssVarMap: Map<string, string>,
  varName: string,
  depth = 0,
): string | null {
  if (depth > 4) return null;
  const raw = cssVarMap.get(varName);
  if (!raw) return null;

  const ref = raw.match(/^var\((--[a-zA-Z0-9-_]+)\)$/);
  if (!ref) return raw;
  return resolveCssVarValue(cssVarMap, ref[1], depth + 1);
}

function pickColorFromCandidates(
  cssVarMap: Map<string, string>,
  candidates: string[],
): string | null {
  for (const candidate of candidates) {
    const value = resolveCssVarValue(cssVarMap, candidate);
    if (value) return value;
  }
  return null;
}

function extractHexPalette(html: string): string[] {
  const matches = html.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
  const unique: string[] = [];
  for (const m of matches) {
    if (!unique.includes(m)) unique.push(m);
  }
  return unique;
}

function hexLuminance(hex: string): number {
  const raw = hex.replace("#", "").trim();
  if (!(raw.length === 3 || raw.length === 6)) return 0.5;
  const expanded = raw.length === 3
    ? raw.split("").map((c) => `${c}${c}`).join("")
    : raw;
  const r = parseInt(expanded.slice(0, 2), 16) / 255;
  const g = parseInt(expanded.slice(2, 4), 16) / 255;
  const b = parseInt(expanded.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function buildPreviewHtmlFromTheme(name: string, colors: ThemeColors, fonts: ThemeFonts): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(fonts.display).replace(/%20/g, "+")}\u0026family=${encodeURIComponent(fonts.body).replace(/%20/g, "+")}\u0026display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: ${colors.background};
      --fg: ${colors.foreground};
      --accent: ${colors.accent};
      --accent-fg: ${colors.accentForeground};
      --muted: ${colors.muted};
      --muted-fg: ${colors.mutedForeground};
      --surface: ${colors.surface};
      --surface-fg: ${colors.surfaceForeground};
      --border: ${colors.border};
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: var(--bg);
      color: var(--fg);
      font-family: "${fonts.body}", ui-sans-serif, system-ui, sans-serif;
      padding: 24px;
    }
    .card {
      width: min(820px, 100%);
      border: 1px solid var(--border);
      border-radius: 20px;
      background: var(--surface);
      color: var(--surface-fg);
      padding: clamp(1.2rem, 3vw, 2rem);
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    h1 {
      margin: 0 0 0.5rem;
      font-family: "${fonts.display}", ui-sans-serif, system-ui, sans-serif;
      font-size: clamp(1.5rem, 4vw, 2.4rem);
      line-height: 1.1;
      color: var(--fg);
    }
    p {
      margin: 0;
      color: var(--muted-fg);
      line-height: 1.6;
    }
    .badge {
      display: inline-block;
      margin-top: 1rem;
      border-radius: 999px;
      padding: 0.45rem 0.8rem;
      background: var(--accent);
      color: var(--accent-fg);
      font-size: 0.85rem;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <article class="card">
    <h1>${name}</h1>
    <p>Extracted style preview from a generated presentation.</p>
    <span class="badge">Accent sample</span>
  </article>
</body>
</html>`;
}

function extractThemeFromHtml(html: string): {
  colors: ThemeColors;
  fonts: ThemeFonts;
  spacing: "compact" | "balanced" | "spacious";
  layoutStyle?: string;
} {
  const cssVarMap = parseCssVariables(html);
  const palette = extractHexPalette(html);

  const fallback = {
    background: palette[0] ?? "#0b1020",
    foreground: palette[1] ?? "#f8fafc",
    accent: palette[2] ?? "#ff6b6b",
    muted: palette[3] ?? "#1f2937",
    mutedForeground: palette[4] ?? "#94a3b8",
    surface: palette[5] ?? "#111827",
    surfaceForeground: palette[6] ?? "#e5e7eb",
    border: palette[7] ?? "#334155",
  };

  const background = pickColorFromCandidates(cssVarMap, [
    "--theme-bg",
    "--bg-primary",
    "--bg",
    "--background",
    "--color-bg",
  ]) ?? fallback.background;

  const foreground = pickColorFromCandidates(cssVarMap, [
    "--theme-fg",
    "--text-primary",
    "--fg",
    "--foreground",
    "--color-fg",
  ]) ?? fallback.foreground;

  const accent = pickColorFromCandidates(cssVarMap, [
    "--theme-accent",
    "--accent",
    "--primary",
    "--brand",
    "--color-accent",
  ]) ?? fallback.accent;

  const accentForeground = pickColorFromCandidates(cssVarMap, [
    "--theme-accent-fg",
    "--accent-foreground",
    "--on-accent",
    "--color-on-accent",
  ]) ?? (hexLuminance(accent) > 0.6 ? "#111827" : "#ffffff");

  const muted = pickColorFromCandidates(cssVarMap, [
    "--theme-muted",
    "--muted",
    "--secondary",
    "--color-muted",
  ]) ?? fallback.muted;

  const mutedForeground = pickColorFromCandidates(cssVarMap, [
    "--theme-muted-fg",
    "--muted-foreground",
    "--text-muted",
    "--color-muted-fg",
  ]) ?? fallback.mutedForeground;

  const surface = pickColorFromCandidates(cssVarMap, [
    "--theme-surface",
    "--surface",
    "--card",
    "--color-surface",
  ]) ?? fallback.surface;

  const surfaceForeground = pickColorFromCandidates(cssVarMap, [
    "--theme-surface-fg",
    "--surface-foreground",
    "--text-on-surface",
    "--color-surface-fg",
  ]) ?? fallback.surfaceForeground;

  const border = pickColorFromCandidates(cssVarMap, [
    "--theme-border",
    "--border",
    "--line",
    "--color-border",
  ]) ?? fallback.border;

  const displayFont = normalizeFontName(
    pickColorFromCandidates(cssVarMap, [
      "--theme-font-display",
      "--font-display",
      "--heading-font",
    ]) ??
      html.match(/h1\s*\{[\s\S]*?font-family\s*:\s*([^;]+);/i)?.[1],
  ) ?? "Poppins";

  const bodyFont = normalizeFontName(
    pickColorFromCandidates(cssVarMap, [
      "--theme-font-body",
      "--font-body",
      "--body-font",
    ]) ??
      html.match(/body\s*\{[\s\S]*?font-family\s*:\s*([^;]+);/i)?.[1],
  ) ?? "Inter";

  const spacingToken =
    pickColorFromCandidates(cssVarMap, ["--spacing", "--density", "--slide-padding"]) ??
    "";
  const spacing = /compact|tight/i.test(spacingToken)
    ? "compact"
    : /spacious|loose/i.test(spacingToken)
      ? "spacious"
      : "balanced";

  const source = html.toLowerCase();
  const layoutStyle = source.includes("split")
    ? "split-panel"
    : source.includes("editorial")
      ? "editorial"
      : source.includes("terminal")
        ? "terminal"
        : source.includes("grid")
          ? "grid"
          : source.includes("asymmetric")
            ? "asymmetric"
            : source.includes("center")
              ? "centered"
              : undefined;

  return {
    colors: {
      background,
      foreground,
      accent,
      accentForeground,
      muted,
      mutedForeground,
      surface,
      surfaceForeground,
      border,
    },
    fonts: {
      display: displayFont,
      body: bodyFont,
    },
    spacing,
    layoutStyle,
  };
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
      previewSlideHtml: theme.previewSlideHtml,
      presentationCss: theme.presentationCss,
      // Note: previewImageId is intentionally not copied — the screenshot is
      // specific to the original; a new one should be captured if needed.
      createdAt: Date.now(),
    });
  },
});

export const saveFromPresentation = mutation({
  args: {
    presentationId: v.id("presentations"),
    name: v.optional(v.string()),
    previewImageId: v.optional(v.id("_storage")),
  },
  returns: v.id("themes"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const presentation = await ctx.db.get(args.presentationId);
    if (!presentation || presentation.userId !== userId) {
      throw new Error("Presentation not found");
    }

    const html = presentation.htmlContent;
    const extracted = extractThemeFromHtml(html);
    const cssVariables = compileCssVariables(extracted.colors, extracted.fonts);
    const name = args.name?.trim() || `Theme from ${presentation.title}`;

    // Extract rich style references for faithful AI reproduction
    const presentationCss = extractFullCss(html);
    const previewSlideDoc = buildFirstSlideDocument(html);

    // Extract just the first slide <section> for the AI prompt code context
    const slides = findSlides(html);
    const previewSlideHtml =
      slides.length > 0
        ? html.slice(slides[0].startOffset, slides[0].endOffset)
        : "";

    return await ctx.db.insert("themes", {
      userId,
      name,
      description: `Extracted from presentation: ${presentation.title}`,
      colors: extracted.colors,
      fonts: extracted.fonts,
      spacing: extracted.spacing,
      layoutStyle: extracted.layoutStyle,
      cssVariables,
      // Use the real first slide as the preview (replaces the generic card)
      previewHtml: previewSlideDoc || buildPreviewHtmlFromTheme(name, extracted.colors, extracted.fonts),
      previewSlideHtml,
      presentationCss,
      previewImageId: args.previewImageId,
      createdAt: Date.now(),
    });
  },
});

/** Generate a signed upload URL for uploading a theme preview screenshot. */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

/** Attach a preview screenshot (already uploaded to storage) to a theme. */
export const setPreviewImage = mutation({
  args: {
    themeId: v.id("themes"),
    previewImageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const theme = await ctx.db.get(args.themeId);
    if (!theme || theme.userId !== userId) throw new Error("Theme not found");
    // Delete old preview image if present
    if (theme.previewImageId) {
      await ctx.storage.delete(theme.previewImageId);
    }
    await ctx.db.patch(args.themeId, { previewImageId: args.previewImageId });
    return null;
  },
});

/** Resolve the signed URL of a theme's preview image (for use in actions). */
export const getPreviewImageUrl = internalQuery({
  args: { previewImageId: v.id("_storage") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.previewImageId);
  },
});
