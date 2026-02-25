import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Copy, Trash2, Pencil, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface ThemeCardProps {
  themeId: Id<"themes">;
  name: string;
  colors: ThemeColors;
  fonts: { display: string; body: string };
  spacing: string;
  previewHtml?: string;
  onEdit?: () => void;
  onSelect?: () => void;
  isSelected?: boolean;
  compact?: boolean;
}

export function ThemeCard({
  themeId,
  name,
  colors,
  fonts,
  previewHtml,
  onEdit,
  onSelect,
  isSelected,
  compact,
}: ThemeCardProps) {
  const duplicateTheme = useMutation(api.themes.duplicate);
  const removeTheme = useMutation(api.themes.remove);

  const handleDuplicate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await duplicateTheme({ themeId });
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Delete this theme?")) {
      await removeTheme({ themeId });
    }
  };

  if (compact) {
    return (
      <button
        onClick={onSelect}
        className={cn(
          "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer",
          isSelected
            ? "bg-coral/10 border border-coral/30"
            : "hover:bg-surface border border-transparent hover:border-border-light"
        )}
      >
        {/* Color swatches */}
        <div className="flex items-center gap-0.5 shrink-0">
          {[colors.background, colors.accent, colors.foreground].map(
            (c, i) => (
              <div
                key={i}
                className="h-4 w-4 rounded-full border border-border-light"
                style={{ backgroundColor: c }}
              />
            )
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate text-text-primary">
            {name}
          </p>
          <p className="text-[10px] text-text-tertiary truncate">
            {fonts.display} + {fonts.body}
          </p>
        </div>
        {isSelected && (
          <div className="h-2 w-2 rounded-full bg-coral shrink-0" />
        )}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "bg-surface-elevated rounded-2xl border shadow-card hover:shadow-card-hover transition-all duration-300 overflow-hidden group hover:-translate-y-1",
        isSelected
          ? "border-coral shadow-glow-coral"
          : "border-border-light"
      )}
      onClick={onSelect}
      role={onSelect ? "button" : undefined}
      style={{ cursor: onSelect ? "pointer" : undefined }}
    >
      {/* Preview thumbnail */}
      <div
        className="h-36 relative overflow-hidden"
        style={{ backgroundColor: colors.background }}
      >
        {previewHtml ? (
          <div className="absolute inset-0 overflow-hidden">
            <iframe
              srcDoc={previewHtml}
              sandbox=""
              className="w-[400%] h-[400%] border-0 pointer-events-none origin-top-left"
              style={{ transform: "scale(0.25)" }}
              title={`Preview for ${name}`}
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Palette
              className="h-8 w-8"
              style={{ color: colors.accent }}
            />
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-sm truncate mb-1.5 text-text-primary">
          {name}
        </h3>

        {/* Color swatches strip */}
        <div className="flex items-center gap-1 mb-3">
          {Object.values(colors)
            .slice(0, 6)
            .map((color, i) => (
              <div
                key={i}
                className="h-3 flex-1 first:rounded-l-full last:rounded-r-full"
                style={{ backgroundColor: color }}
              />
            ))}
        </div>

        <p className="text-[10px] text-text-tertiary mb-4 font-mono">
          {fonts.display} · {fonts.body}
        </p>

        <div className="flex gap-2">
          {onEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="rounded-full px-3 text-xs h-7 gap-1"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDuplicate}
            className="rounded-full px-3 text-xs h-7 gap-1"
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            className="rounded-full px-3 text-xs h-7 gap-1 text-red-500 hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
