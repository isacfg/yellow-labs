import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, Sparkles } from "lucide-react";

interface StylePreviewGridProps {
  previews: string[];
  onSelect: (index: number) => void;
  disabled?: boolean;
}

export function StylePreviewGrid({
  previews,
  onSelect,
  disabled = false,
}: StylePreviewGridProps) {
  const [selected, setSelected] = useState<number | null>(null);

  const handleSelect = (index: number) => {
    if (disabled || selected !== null) return;
    setSelected(index);
    onSelect(index);
  };

  return (
    <div className="my-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-coral" />
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          Choose a style
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {previews.map((html, i) => (
          <div
            key={i}
            onClick={() => handleSelect(i)}
            className={cn(
              "relative rounded-2xl border overflow-hidden transition-all duration-200 animate-fade-in",
              selected === i
                ? "border-coral shadow-[0_0_0_2px_var(--color-coral)] shadow-glow-coral"
                : "border-border-light hover:border-coral/40 hover:shadow-card-hover",
              disabled && selected !== i
                ? "opacity-40 cursor-not-allowed"
                : "cursor-pointer"
            )}
            style={{ animationDelay: `${i * 100}ms` }}
          >
            {/* Preview iframe */}
            <div className="aspect-[4/3] bg-surface relative overflow-hidden">
              <iframe
                srcDoc={html}
                sandbox="allow-scripts"
                className="border-0 pointer-events-none absolute top-0 left-0"
                title={`Style option ${i + 1}`}
                style={{
                  width: "400%",
                  height: "400%",
                  transform: "scale(0.25)",
                  transformOrigin: "top left",
                }}
              />
            </div>

            {/* Label */}
            <div className="px-4 py-3 bg-surface-elevated border-t border-border-light flex items-center justify-between">
              <span className="text-xs font-semibold text-text-primary">
                Option {i + 1}
              </span>
              {selected === i ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-coral">
                  <Check className="h-3.5 w-3.5" />
                  Selected
                </span>
              ) : (
                <span className="text-[10px] text-text-tertiary">
                  Click to choose
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      {selected === null && !disabled && (
        <p className="text-xs text-text-tertiary">
          Select a style to continue generating your presentation.
        </p>
      )}
    </div>
  );
}
