import { Pencil, Check } from "lucide-react";

interface EditOperation {
  type: string;
  search?: string;
  replace?: string;
  slideIndex?: number;
  newHtml?: string;
  afterIndex?: number;
  html?: string;
}

interface SmartEditCardProps {
  /** JSON string of the toolCallInput containing the operations */
  toolCallInput?: string;
}

function describeOperation(op: EditOperation): string {
  switch (op.type) {
    case "searchReplace":
      return `Replaced text: "${op.search?.substring(0, 30)}${op.search && op.search.length > 30 ? '...' : ''}"`;
    case "replaceSlide":
      return `Updated slide ${op.slideIndex}`;
    case "insertSlide":
      return op.afterIndex === -1
        ? "Added new slide at the beginning"
        : `Added new slide after slide ${op.afterIndex}`;
    case "deleteSlide":
      return `Removed slide ${op.slideIndex}`;
    default:
      return "Applied edit";
  }
}

export function SmartEditCard({ toolCallInput }: SmartEditCardProps) {
  let operations: EditOperation[] = [];
  try {
    if (toolCallInput) {
      const parsed = JSON.parse(toolCallInput) as { operations?: EditOperation[] };
      operations = parsed.operations ?? [];
    }
  } catch {
    // ignore parse errors
  }

  const opCount = operations.length;

  return (
    <div className="mt-3 border border-border-light rounded-xl bg-surface-elevated overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border-light/50">
        <div className="h-8 w-8 rounded-full bg-surface flex items-center justify-center border border-border-light shadow-sm">
          <Pencil className="h-4 w-4 text-text-secondary" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-text-primary">
            Smart Edit Applied
          </span>
          <span className="text-[11px] text-text-tertiary">
            {opCount} {opCount === 1 ? "operation" : "operations"} completed
          </span>
        </div>
      </div>

      {/* Operations list */}
      {operations.length > 0 && (
        <div className="px-4 py-3 bg-surface/50 space-y-2.5">
          {operations.map((op, i) => (
            <div key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
              <div className="mt-0.5 h-4 w-4 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Check className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="leading-relaxed">{describeOperation(op)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
