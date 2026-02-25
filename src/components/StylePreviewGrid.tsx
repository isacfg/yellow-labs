import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, Sparkles, X } from "lucide-react";

interface StylePreviewGridProps {
  previews: string[];
  names: string[];
  onSelect: (index: number) => void;
  disabled?: boolean;
}

export function StylePreviewGrid({
  previews,
  names,
  onSelect,
  disabled = false,
}: StylePreviewGridProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const handleSelect = (index: number) => {
    if (disabled || selected !== null) return;
    setSelected(index);
    onSelect(index);
  };

  const canChoose = selected === null && !disabled;

  return (
    <>
      <div className="my-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-coral" />
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Choose a style
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {previews.map((html, i) => {
            const name = names[i] ?? `Option ${i + 1}`;
            const isSelected = selected === i;

            return (
              <div
                key={i}
                className={cn(
                  "relative rounded-2xl border overflow-hidden transition-all duration-200 animate-fade-in",
                  isSelected
                    ? "border-coral shadow-[0_0_0_2px_var(--color-coral)] shadow-glow-coral"
                    : "border-border-light",
                  disabled && !isSelected ? "opacity-40" : "",
                )}
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {/* Preview iframe */}
                <div className="aspect-[4/3] bg-surface relative overflow-hidden">
                  <iframe
                    srcDoc={html}
                    sandbox="allow-scripts"
                    className="border-0 pointer-events-none absolute top-0 left-0"
                    title={name}
                    style={{
                      width: "400%",
                      height: "400%",
                      transform: "scale(0.25)",
                      transformOrigin: "top left",
                    }}
                  />
                </div>

                {/* Footer */}
                <div className="px-3 py-2.5 bg-surface-elevated border-t border-border-light flex items-center gap-2">
                  <span className={cn("text-xs font-semibold truncate flex-1", isSelected ? "text-coral" : "text-text-primary")}>
                    {isSelected && <Check className="h-3 w-3 inline mr-1 shrink-0" />}
                    {name}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setPreviewIndex(i)}
                      className="h-6 px-2 rounded-lg text-[10px] font-medium border border-border-light text-text-secondary hover:border-coral/40 hover:text-coral transition-colors"
                    >
                      Preview
                    </button>
                    {canChoose && (
                      <button
                        onClick={() => handleSelect(i)}
                        className="h-6 px-2 rounded-lg text-[10px] font-medium bg-coral text-white hover:opacity-90 transition-opacity"
                      >
                        Choose
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {canChoose && (
          <p className="text-xs text-text-tertiary">
            Select a style to continue generating your presentation.
          </p>
        )}
      </div>

      {/* Side preview panel */}
      {previewIndex !== null && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setPreviewIndex(null)}
          />

          {/* Panel */}
          <div className="fixed top-0 right-0 h-full w-[65vw] max-w-5xl bg-surface border-l border-border-light shadow-2xl z-50 flex flex-col">
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border-light shrink-0">
              <span className="text-sm font-semibold text-text-primary">
                {names[previewIndex] ?? `Option ${previewIndex + 1}`}
              </span>
              <div className="flex items-center gap-2">
                {canChoose && (
                  <button
                    onClick={() => {
                      handleSelect(previewIndex);
                      setPreviewIndex(null);
                    }}
                    className="h-7 px-3 rounded-xl text-xs font-semibold bg-coral text-white hover:opacity-90 transition-opacity"
                  >
                    Choose this style
                  </button>
                )}
                <button
                  onClick={() => setPreviewIndex(null)}
                  className="h-7 w-7 rounded-xl flex items-center justify-center border border-border-light text-text-secondary hover:text-text-primary transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Full preview */}
            <iframe
              srcDoc={previews[previewIndex]}
              sandbox="allow-scripts"
              className="flex-1 border-0 w-full"
              title={`Preview: ${names[previewIndex] ?? `Option ${previewIndex + 1}`}`}
            />
          </div>
        </>
      )}
    </>
  );
}
