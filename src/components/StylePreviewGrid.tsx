import { useState } from "react";
import { cn } from "@/lib/utils";

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
      <p className="text-sm font-medium text-muted-foreground">
        Choose a style that feels right for your presentation:
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {previews.map((html, i) => (
          <div
            key={i}
            className={cn(
              "relative rounded-lg border-2 overflow-hidden cursor-pointer transition-all",
              selected === i
                ? "border-primary shadow-lg ring-2 ring-primary"
                : "border-border hover:border-primary/50",
              disabled && selected !== i && "opacity-50 cursor-not-allowed"
            )}
            onClick={() => handleSelect(i)}
          >
            {/* Preview iframe */}
            <div className="aspect-video bg-background">
              <iframe
                srcDoc={html}
                sandbox="allow-scripts"
                className="w-full h-full border-0 pointer-events-none"
                title={`Style option ${i + 1}`}
                style={{ transform: "scale(0.5)", transformOrigin: "top left", width: "200%", height: "200%" }}
              />
            </div>
            {/* Label */}
            <div className="p-2 bg-background/95 border-t flex items-center justify-between">
              <span className="text-xs font-medium">Option {i + 1}</span>
              {selected === i ? (
                <span className="text-xs text-primary font-semibold">Selected ✓</span>
              ) : (
                <span className="text-xs text-muted-foreground">Click to choose</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {selected === null && !disabled && (
        <p className="text-xs text-muted-foreground">
          Click a style to select it and continue generating your presentation.
        </p>
      )}
    </div>
  );
}
