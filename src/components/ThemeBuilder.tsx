import { useState, useCallback, useRef, useEffect } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Wand2,
  Palette,
  Type,
  Maximize2,
  Layout,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ThemeColors {
  background: string;
  foreground: string;
  accent: string;
  accentForeground: string;
  muted: string;
  mutedForeground: string;
  surface: string;
  surfaceForeground: string;
  border: string;
}

interface ThemeFonts {
  display: string;
  body: string;
}

type Spacing = "compact" | "balanced" | "spacious";

interface ThemeData {
  name: string;
  colors: ThemeColors;
  fonts: ThemeFonts;
  spacing: Spacing;
  layoutStyle?: string;
  previewHtml?: string;
}

interface ThemeBuilderProps {
  editingThemeId?: Id<"themes">;
  initialTheme?: ThemeData;
  onSaved?: (themeId: Id<"themes">) => void;
  onCancel?: () => void;
}

// ─── Mood Chips ──────────────────────────────────────────────────────────────

const MOOD_CHIPS = [
  { label: "Dark", emoji: "🌑" },
  { label: "Warm", emoji: "🔥" },
  { label: "Minimal", emoji: "◻️" },
  { label: "Playful", emoji: "🎨" },
  { label: "Corporate", emoji: "💼" },
  { label: "Retro", emoji: "📺" },
  { label: "Futuristic", emoji: "🚀" },
  { label: "Elegant", emoji: "✨" },
  { label: "Bold", emoji: "⚡" },
  { label: "Organic", emoji: "🌿" },
  { label: "Neon", emoji: "💜" },
  { label: "Editorial", emoji: "📰" },
];

const PLACEHOLDER_VIBES = [
  "dark and mysterious like a film noir",
  "warm and cozy like a coffee shop in autumn",
  "electric and bold like a neon sign at midnight",
  "clean and minimal like a Scandinavian studio",
  "playful and colorful like a candy store",
  "elegant and refined like a luxury magazine",
  "futuristic and techy like a cyberpunk dashboard",
  "organic and earthy like a botanical garden",
  "retro and groovy like a 70s vinyl cover",
  "editorial and sharp like a fashion lookbook",
];

const SPACING_OPTIONS: { value: Spacing; label: string; desc: string }[] = [
  { value: "compact", label: "Compact", desc: "Dense, information-rich" },
  { value: "balanced", label: "Balanced", desc: "Harmonious proportions" },
  { value: "spacious", label: "Spacious", desc: "Generous breathing room" },
];

const LAYOUT_OPTIONS = [
  { value: "centered", label: "Centered" },
  { value: "split-panel", label: "Split" },
  { value: "asymmetric", label: "Asymmetric" },
  { value: "editorial", label: "Editorial" },
  { value: "grid", label: "Grid" },
  { value: "terminal", label: "Terminal" },
];

const COLOR_LABELS: Record<keyof ThemeColors, string> = {
  background: "Background",
  foreground: "Text",
  accent: "Accent",
  accentForeground: "Accent Text",
  muted: "Muted",
  mutedForeground: "Muted Text",
  surface: "Surface",
  surfaceForeground: "Surface Text",
  border: "Border",
};

// ─── Component ───────────────────────────────────────────────────────────────

export function ThemeBuilder({
  editingThemeId,
  initialTheme,
  onSaved,
  onCancel,
}: ThemeBuilderProps) {
  const generateTheme = useAction(api.ai.generateTheme);
  const refineTheme = useAction(api.ai.refineTheme);
  const createTheme = useMutation(api.themes.create);
  const updateTheme = useMutation(api.themes.update);

  const [description, setDescription] = useState("");
  const [refinement, setRefinement] = useState("");
  const [activeMoods, setActiveMoods] = useState<string[]>([]);
  const [theme, setTheme] = useState<ThemeData | null>(initialTheme ?? null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showRefinement, setShowRefinement] = useState(false);
  const [history, setHistory] = useState<ThemeData[]>([]);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const previewRef = useRef<HTMLIFrameElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Rotate placeholder text
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDER_VIBES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const toggleMood = useCallback((mood: string) => {
    setActiveMoods((prev) =>
      prev.includes(mood) ? prev.filter((m) => m !== mood) : [...prev, mood]
    );
  }, []);

  const buildPrompt = useCallback(() => {
    const parts: string[] = [];
    if (description.trim()) parts.push(description.trim());
    if (activeMoods.length > 0)
      parts.push(`Mood: ${activeMoods.join(", ")}`);
    return parts.join(". ") || "A modern, sophisticated presentation theme";
  }, [description, activeMoods]);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const result = await generateTheme({ description: buildPrompt() });
      const newTheme: ThemeData = {
        name: result.name,
        colors: result.colors,
        fonts: result.fonts,
        spacing: result.spacing,
        layoutStyle: result.layoutStyle,
        previewHtml: result.previewHtml,
      };
      if (theme) setHistory((prev) => [...prev, theme]);
      setTheme(newTheme);
      setShowRefinement(true);
    } catch (err) {
      console.error("Theme generation failed:", err);
    } finally {
      setIsGenerating(false);
    }
  }, [generateTheme, buildPrompt, theme]);

  const handleRefine = useCallback(async () => {
    if (!editingThemeId && !theme) return;
    setIsRefining(true);
    try {
      let result;
      if (editingThemeId) {
        result = await refineTheme({
          themeId: editingThemeId,
          instruction: refinement,
        });
      } else {
        // For new themes, save temporarily then refine — but we can use generate with context
        const prompt = `Starting from a theme called "${theme!.name}" with colors: ${JSON.stringify(theme!.colors)} and fonts: ${JSON.stringify(theme!.fonts)}. Refinement: ${refinement}`;
        result = await generateTheme({ description: prompt });
      }
      const newTheme: ThemeData = {
        name: result.name,
        colors: result.colors,
        fonts: result.fonts,
        spacing: result.spacing,
        layoutStyle: result.layoutStyle,
        previewHtml: result.previewHtml,
      };
      if (theme) setHistory((prev) => [...prev, theme]);
      setTheme(newTheme);
      setRefinement("");
    } catch (err) {
      console.error("Theme refinement failed:", err);
    } finally {
      setIsRefining(false);
    }
  }, [editingThemeId, theme, refinement, refineTheme, generateTheme]);

  const handleSave = useCallback(async () => {
    if (!theme) return;
    setIsSaving(true);
    try {
      if (editingThemeId) {
        await updateTheme({
          themeId: editingThemeId,
          name: theme.name,
          description: description || undefined,
          colors: theme.colors,
          fonts: theme.fonts,
          spacing: theme.spacing,
          layoutStyle: theme.layoutStyle,
          previewHtml: theme.previewHtml,
        });
        onSaved?.(editingThemeId);
      } else {
        const themeId = await createTheme({
          name: theme.name,
          description: description || undefined,
          colors: theme.colors,
          fonts: theme.fonts,
          spacing: theme.spacing,
          layoutStyle: theme.layoutStyle,
          previewHtml: theme.previewHtml,
        });
        onSaved?.(themeId);
      }
    } catch (err) {
      console.error("Theme save failed:", err);
    } finally {
      setIsSaving(false);
    }
  }, [
    theme,
    editingThemeId,
    description,
    updateTheme,
    createTheme,
    onSaved,
  ]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setTheme(prev);
  }, [history]);

  const handleColorChange = useCallback(
    (key: keyof ThemeColors, value: string) => {
      if (!theme) return;
      setTheme((t) =>
        t ? { ...t, colors: { ...t.colors, [key]: value } } : t
      );
    },
    [theme]
  );

  const handleFontChange = useCallback(
    (key: "display" | "body", value: string) => {
      if (!theme) return;
      setTheme((t) =>
        t ? { ...t, fonts: { ...t.fonts, [key]: value } } : t
      );
    },
    [theme]
  );

  return (
    <div className="h-full flex flex-col lg:flex-row gap-0 bg-surface text-text-primary overflow-hidden">
      {/* ── Left: Generative Input ── */}
      <div className="lg:w-[42%] flex flex-col border-r border-border-light relative overflow-y-auto bg-surface-elevated">
        <div className="relative z-10 flex flex-col h-full p-6 lg:p-8">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl gradient-coral flex items-center justify-center shadow-sm">
                <Wand2 className="h-4.5 w-4.5 text-white" />
              </div>
              {editingThemeId ? "Refine Theme" : "Create Theme"}
            </h2>
            <p className="text-sm text-text-tertiary ml-12">
              Describe a vibe and let AI design your perfect theme
            </p>
          </div>

          {/* Mood Input */}
          <div className="mb-6">
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
              Describe the feeling
            </label>
            <div className="relative group">
              <textarea
                ref={inputRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={PLACEHOLDER_VIBES[placeholderIndex]}
                rows={3}
                className="w-full bg-white border border-border-light rounded-2xl px-5 py-4 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-coral focus:ring-1 focus:ring-coral/20 transition-all resize-none leading-relaxed shadow-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
              />
              <div className="absolute bottom-3 right-3 text-[10px] text-text-tertiary">
                ⌘ + Enter
              </div>
            </div>
          </div>

          {/* Mood Chips */}
          <div className="mb-8">
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
              Mood tags
            </label>
            <div className="flex flex-wrap gap-2">
              {MOOD_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => toggleMood(chip.label.toLowerCase())}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all duration-300 cursor-pointer",
                    activeMoods.includes(chip.label.toLowerCase())
                      ? "bg-coral/10 border-coral/30 text-coral shadow-sm"
                      : "bg-surface border-border-light text-text-secondary hover:text-text-primary hover:border-border"
                  )}
                >
                  <span className="mr-1.5">{chip.emoji}</span>
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className={cn(
              "relative w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 cursor-pointer overflow-hidden group flex items-center justify-center gap-2",
              isGenerating
                ? "bg-surface border border-border-light text-text-tertiary"
                : "gradient-coral text-white shadow-glow-coral hover:opacity-90"
            )}
          >
            <Sparkles
              className={cn(
                "h-4 w-4",
                isGenerating && "animate-spin"
              )}
            />
            {isGenerating ? "Generating..." : "Generate Theme"}
          </button>

          {/* ── Refinement Section ── */}
          {theme && showRefinement && (
            <div className="mt-8 pt-6 border-t border-border-light">
              <div className="flex items-center justify-between mb-4">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Refine
                </label>
                <button
                  onClick={handleUndo}
                  disabled={history.length === 0}
                  className="text-xs text-text-tertiary hover:text-text-primary transition-colors flex items-center gap-1.5 disabled:opacity-30 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  Undo
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  value={refinement}
                  onChange={(e) => setRefinement(e.target.value)}
                  placeholder="Make the accent more electric blue..."
                  className="flex-1 bg-white border border-border-light rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-coral focus:ring-1 focus:ring-coral/20 transition-all shadow-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleRefine();
                    }
                  }}
                />
                <button
                  onClick={handleRefine}
                  disabled={isRefining || !refinement.trim()}
                  className="px-4 py-3 rounded-xl bg-text-primary text-white hover:bg-text-primary/90 transition-all disabled:opacity-30 cursor-pointer shadow-sm flex items-center justify-center"
                >
                  <Wand2
                    className={cn(
                      "h-4 w-4",
                      isRefining && "animate-spin"
                    )}
                  />
                </button>
              </div>
            </div>
          )}

          {/* ── Manual Controls (collapsible) ── */}
          {theme && (
            <ManualControls
              theme={theme}
              onColorChange={handleColorChange}
              onFontChange={handleFontChange}
              onSpacingChange={(s) =>
                setTheme((t) => (t ? { ...t, spacing: s } : t))
              }
              onLayoutChange={(l) =>
                setTheme((t) => (t ? { ...t, layoutStyle: l } : t))
              }
              onNameChange={(name) =>
                setTheme((t) => (t ? { ...t, name } : t))
              }
            />
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Save / Cancel */}
          {theme && (
            <div className="flex gap-3 mt-8 pt-6 border-t border-border-light">
              {onCancel && (
                <Button
                  variant="ghost"
                  onClick={onCancel}
                  className="flex-1 text-text-secondary hover:text-text-primary hover:bg-surface rounded-xl"
                >
                  Cancel
                </Button>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 py-3 rounded-xl bg-text-primary text-white font-semibold text-sm hover:bg-text-primary/90 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
              >
                <Save className="h-4 w-4" />
                {isSaving
                  ? "Saving..."
                  : editingThemeId
                    ? "Update Theme"
                    : "Save to Library"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Live Preview ── */}
      <div className="flex-1 flex flex-col min-h-0 relative bg-surface">
        {theme ? (
          <>
            {/* Theme DNA Strip */}
            <div className="px-6 py-4 border-b border-border-light flex items-center gap-4 bg-surface-elevated">
              <div className="flex items-center gap-1.5 mr-2">
                {Object.entries(theme.colors)
                  .slice(0, 5)
                  .map(([key, color]) => (
                    <div
                      key={key}
                      className="h-5 w-5 rounded-full border border-border-light transition-colors duration-700 shadow-sm"
                      style={{ backgroundColor: color }}
                      title={COLOR_LABELS[key as keyof ThemeColors]}
                    />
                  ))}
              </div>
              <div className="h-4 w-px bg-border-light" />
              <span className="text-sm font-semibold text-text-primary tracking-tight">
                {theme.name}
              </span>
              <div className="flex-1" />
              <span className="text-xs text-text-tertiary font-mono">
                {theme.fonts.display} + {theme.fonts.body}
              </span>
            </div>

            {/* Preview iframe */}
            <div className="flex-1 relative bg-surface p-4">
              {theme.previewHtml ? (
                <iframe
                  ref={previewRef}
                  srcDoc={theme.previewHtml}
                  sandbox="allow-scripts"
                  className="w-full h-full border border-border-light rounded-xl shadow-card bg-white"
                  title="Theme preview"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="h-20 w-20 rounded-3xl bg-surface-elevated border border-border-light flex items-center justify-center mx-auto mb-5 shadow-sm">
                      <Maximize2 className="h-8 w-8 text-text-tertiary" />
                    </div>
                    <p className="text-sm font-medium text-text-tertiary">
                      Preview will appear after generation
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-xs">
              <div className="h-20 w-20 rounded-3xl bg-surface-elevated border border-border-light flex items-center justify-center mx-auto mb-6 shadow-sm">
                <Palette className="h-8 w-8 text-coral" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                Describe your vision
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Type a mood, pick some tags, and let AI craft a unique
                presentation theme for you
              </p>
            </div>
          </div>
        )}

        {/* History timeline */}
        {history.length > 0 && (
          <div className="absolute top-20 right-8 flex flex-col gap-2">
            {history.map((h, i) => (
              <button
                key={i}
                onClick={() => {
                  const rest = history.slice(0, i);
                  const selected = history[i];
                  if (theme) setHistory([...rest, theme]);
                  else setHistory(rest);
                  setTheme(selected);
                }}
                className="h-4 w-4 rounded-full border border-border hover:border-text-primary transition-all cursor-pointer shadow-sm"
                style={{ backgroundColor: h.colors.accent }}
                title={h.name}
              />
            ))}
            <div
              className="h-4 w-4 rounded-full ring-2 ring-text-primary shadow-sm"
              style={{
                backgroundColor: theme?.colors.accent ?? "#FF5A3D",
              }}
              title="Current"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Manual Controls Sub-component ───────────────────────────────────────────

function ManualControls({
  theme,
  onColorChange,
  onFontChange,
  onSpacingChange,
  onLayoutChange,
  onNameChange,
}: {
  theme: ThemeData;
  onColorChange: (key: keyof ThemeColors, value: string) => void;
  onFontChange: (key: "display" | "body", value: string) => void;
  onSpacingChange: (spacing: Spacing) => void;
  onLayoutChange: (layout: string) => void;
  onNameChange: (name: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mt-6">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-xs font-semibold text-text-secondary uppercase tracking-wider hover:text-text-primary transition-colors cursor-pointer w-full"
      >
        <span>Fine-tune</span>
        {isExpanded ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-6 animate-fade-in">
          {/* Name */}
          <div>
            <label className="block text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Theme Name
            </label>
            <input
              value={theme.name}
              onChange={(e) => onNameChange(e.target.value)}
              className="w-full bg-white border border-border-light rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-coral focus:ring-1 focus:ring-coral/20 transition-all shadow-sm"
            />
          </div>

          {/* Colors */}
          <div>
            <label className="flex items-center gap-2 text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-3">
              <Palette className="h-3 w-3" />
              Colors
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                Object.entries(theme.colors) as [keyof ThemeColors, string][]
              ).map(([key, value]) => (
                <label
                  key={key}
                  className="flex items-center gap-2 bg-surface rounded-lg px-2.5 py-2 border border-border-light cursor-pointer group hover:border-border transition-all shadow-sm"
                >
                  <input
                    type="color"
                    value={value}
                    onChange={(e) => onColorChange(key, e.target.value)}
                    className="h-5 w-5 rounded-md border-0 cursor-pointer bg-transparent [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
                  />
                  <span className="text-[10px] text-text-secondary group-hover:text-text-primary transition-colors truncate">
                    {COLOR_LABELS[key]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Fonts */}
          <div>
            <label className="flex items-center gap-2 text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-3">
              <Type className="h-3 w-3" />
              Fonts
            </label>
            <div className="space-y-2">
              <div>
                <span className="text-[10px] text-text-tertiary block mb-1">
                  Display
                </span>
                <input
                  value={theme.fonts.display}
                  onChange={(e) => onFontChange("display", e.target.value)}
                  className="w-full bg-white border border-border-light rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-coral focus:ring-1 focus:ring-coral/20 transition-all shadow-sm"
                  placeholder="e.g. Archivo Black"
                />
              </div>
              <div>
                <span className="text-[10px] text-text-tertiary block mb-1">
                  Body
                </span>
                <input
                  value={theme.fonts.body}
                  onChange={(e) => onFontChange("body", e.target.value)}
                  className="w-full bg-white border border-border-light rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-coral focus:ring-1 focus:ring-coral/20 transition-all shadow-sm"
                  placeholder="e.g. Space Grotesk"
                />
              </div>
            </div>
          </div>

          {/* Spacing */}
          <div>
            <label className="flex items-center gap-2 text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-3">
              <Maximize2 className="h-3 w-3" />
              Spacing
            </label>
            <div className="flex gap-2">
              {SPACING_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onSpacingChange(opt.value)}
                  className={cn(
                    "flex-1 text-center py-2.5 rounded-lg text-xs font-medium border transition-all cursor-pointer shadow-sm",
                    theme.spacing === opt.value
                      ? "bg-coral/10 border-coral/30 text-coral"
                      : "bg-surface border-border-light text-text-secondary hover:text-text-primary hover:border-border"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Layout */}
          <div>
            <label className="flex items-center gap-2 text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-3">
              <Layout className="h-3 w-3" />
              Layout
            </label>
            <div className="grid grid-cols-3 gap-2">
              {LAYOUT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onLayoutChange(opt.value)}
                  className={cn(
                    "py-2 rounded-lg text-xs font-medium border transition-all cursor-pointer shadow-sm",
                    theme.layoutStyle === opt.value
                      ? "bg-coral/10 border-coral/30 text-coral"
                      : "bg-surface border-border-light text-text-secondary hover:text-text-primary hover:border-border"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
