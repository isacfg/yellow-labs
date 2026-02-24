interface Option {
  label: string;
  description: string;
}

export interface AskUserQuestion {
  header: string;
  question: string;
  options: Option[];
  multiSelect?: boolean;
}

interface AskUserQuestionCardProps {
  questions: AskUserQuestion[];
  currentQuestionIdx: number;
  pendingAnswers: Record<number, string>;
  onAnswer: (questionIdx: number, label: string) => void;
  onNext: () => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function AskUserQuestionCard({
  questions,
  currentQuestionIdx,
  pendingAnswers,
  onAnswer,
  onNext,
  onSubmit,
  disabled = false,
}: AskUserQuestionCardProps) {
  const question = questions[currentQuestionIdx];
  if (!question) return null;

  const rawSelection = pendingAnswers[currentQuestionIdx] ?? "";
  const selectedLabels = rawSelection ? rawSelection.split(",").map((s) => s.trim()) : [];
  const isMultiSelect = question.multiSelect === true;
  const isLastQuestion = currentQuestionIdx === questions.length - 1;
  const canAdvance = selectedLabels.length > 0 && !disabled;

  return (
    <div className="bg-surface-elevated border border-border-light rounded-2xl rounded-tl-md overflow-hidden shadow-card">
      {/* Progress bar — only shown when there are multiple questions */}
      {questions.length > 1 && (
        <div className="flex items-center gap-1.5 px-4 pt-4">
          {questions.map((_, i) => (
            <div
              key={i}
              className={[
                "h-1 flex-1 rounded-full transition-colors",
                i < currentQuestionIdx
                  ? "bg-coral"
                  : i === currentQuestionIdx
                    ? "bg-coral/60"
                    : "bg-border-light",
              ].join(" ")}
            />
          ))}
        </div>
      )}

      {/* Header badge + question text */}
      <div className="px-4 pt-4 pb-3">
        <span className="inline-block text-xs font-bold text-coral bg-coral/10 px-2 py-0.5 rounded-full mb-2">
          {question.header}
        </span>
        <p className="text-sm font-semibold text-text-primary leading-snug">
          {question.question}
        </p>
      </div>

      {/* Option cards */}
      <div className="px-4 pb-4 flex flex-col gap-2">
        {question.options.map((option) => {
          const isSelected = selectedLabels.includes(option.label);
          const handleOptionClick = () => {
            if (disabled) return;
            if (isMultiSelect) {
              const newSelections = isSelected
                ? selectedLabels.filter((l) => l !== option.label)
                : [...selectedLabels, option.label];
              onAnswer(currentQuestionIdx, newSelections.join(", "));
            } else {
              onAnswer(currentQuestionIdx, option.label);
            }
          };
          return (
            <button
              key={option.label}
              onClick={handleOptionClick}
              disabled={disabled}
              className={[
                "text-left rounded-xl border px-3.5 py-2.5 transition-all",
                isSelected
                  ? "border-coral bg-coral/8 shadow-sm"
                  : "border-border-light hover:border-coral/40",
                disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
              ].join(" ")}
            >
              <p className={`text-sm font-semibold ${isSelected ? "text-coral" : "text-text-primary"}`}>
                {isMultiSelect ? (isSelected ? "✓ " : "◻ ") : ""}{option.label}
              </p>
              {option.description && (
                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                  {option.description}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Action button */}
      <div className="border-t border-border-light px-4 py-3 flex justify-end">
        <button
          onClick={isLastQuestion ? onSubmit : onNext}
          disabled={!canAdvance}
          className={[
            "text-sm font-semibold px-4 py-2 rounded-xl transition-all",
            canAdvance
              ? "bg-coral text-white shadow-sm hover:bg-coral-dark"
              : "bg-border-light text-text-tertiary cursor-not-allowed",
          ].join(" ")}
        >
          {isLastQuestion ? "Submit →" : "Next →"}
        </button>
      </div>
    </div>
  );
}
