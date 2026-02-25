import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ThemeCard } from "@/components/ThemeCard";
import { Palette, X, Plus, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

interface ThemePickerProps {
  conversationId: Id<"conversations">;
  currentThemeId?: Id<"themes">;
}

export function ThemePicker({
  conversationId,
  currentThemeId,
}: ThemePickerProps) {
  const themes = useQuery(api.themes.list) ?? [];
  const currentTheme = themes.find((t) => t._id === currentThemeId);
  const setTheme = useMutation(api.conversations.setTheme);
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const handleSelect = async (themeId: Id<"themes"> | undefined) => {
    await setTheme({ conversationId, themeId });
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer",
          currentTheme
            ? "bg-coral/8 border-coral/20 text-coral hover:bg-coral/12"
            : "bg-surface border-border-light text-text-tertiary hover:text-text-secondary hover:border-text-tertiary"
        )}
      >
        {currentTheme ? (
          <>
            <div className="flex items-center gap-0.5">
              {[
                currentTheme.colors.background,
                currentTheme.colors.accent,
                currentTheme.colors.foreground,
              ].map((c, i) => (
                <div
                  key={i}
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <span className="max-w-25 truncate">
              {currentTheme.name}
            </span>
          </>
        ) : (
          <>
            <Palette className="h-3 w-3" />
            <span>Theme</span>
          </>
        )}
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-72 bg-surface-elevated border border-border-light rounded-2xl shadow-card-hover z-50 animate-scale-in overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border-light flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Select Theme
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Options */}
          <div className="p-2 max-h-72 overflow-y-auto">
            {/* No theme option */}
            <button
              onClick={() => handleSelect(undefined)}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer",
                !currentThemeId
                  ? "bg-surface border border-border"
                  : "hover:bg-surface border border-transparent"
              )}
            >
              <div className="h-8 w-8 rounded-lg bg-surface flex items-center justify-center border border-border-light">
                <X className="h-3.5 w-3.5 text-text-tertiary" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">
                  No theme
                </p>
                <p className="text-[10px] text-text-tertiary">
                  AI will suggest styles during chat
                </p>
              </div>
              {!currentThemeId && (
                <div className="ml-auto h-2 w-2 rounded-full bg-coral" />
              )}
            </button>

            {/* Themes list */}
            {themes.map((t) => (
              <ThemeCard
                key={t._id}
                themeId={t._id}
                name={t.name}
                colors={t.colors}
                fonts={t.fonts}
                spacing={t.spacing}
                compact
                isSelected={t._id === currentThemeId}
                onSelect={() => handleSelect(t._id)}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="px-3 py-2.5 border-t border-border-light">
            <Link
              to="/themes/new"
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-coral hover:bg-coral/5 transition-colors w-full"
            >
              <Plus className="h-3.5 w-3.5" />
              Create new theme
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
