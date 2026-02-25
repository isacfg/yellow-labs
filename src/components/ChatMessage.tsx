import { parseAIResponse } from "@/lib/parseAIResponse";
import { StylePreviewGrid } from "./StylePreviewGrid";
import { PresentationCard } from "./PresentationCard";
import { Loader2, Sparkles, Paperclip } from "lucide-react";
import { AskUserQuestionCard } from "./AskUserQuestionCard";
import type { AskUserQuestion } from "./AskUserQuestionCard";

interface Message {
  _id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming: boolean;
  hasStylePreviews: boolean;
  hasFinalPresentation: boolean;
  hasAttachment?: boolean;
  attachmentName?: string;
  toolCallId?: string;
  toolCallInput?: string;
  toolResultFor?: string;
}

interface PresentationRef {
  slug: string;
  title: string;
  htmlContent: string;
}

interface ChatMessageProps {
  message: Message;
  presentation?: PresentationRef;
  onStyleSelect?: (index: number) => void;
  styleSelectDisabled?: boolean;
  showFullscreen?: boolean;
  // AskUserQuestion props
  currentQuestionIdx?: number;
  pendingAnswers?: Record<number, string>;
  onAnswer?: (questionIdx: number, label: string) => void;
  onNext?: () => void;
  onSubmit?: () => void;
  questionDisabled?: boolean;
  // Answered state: per-question selected labels, indexed by question order
  answeredSelections?: string[];
}

export function ChatMessage({
  message,
  presentation,
  onStyleSelect,
  styleSelectDisabled = false,
  showFullscreen = true,
  currentQuestionIdx,
  pendingAnswers,
  onAnswer,
  onNext,
  onSubmit,
  questionDisabled = false,
  answeredSelections,
}: ChatMessageProps) {
  // Hidden tool result messages — only exist for conversation history
  if (message.toolResultFor) return null;

  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end mb-5 animate-scale-in">
        <div className="max-w-[78%] flex flex-col items-end gap-1.5">
          <div className="rounded-2xl rounded-tr-md bg-coral text-white px-4 py-3 text-sm leading-relaxed shadow-sm">
            {message.content}
          </div>
          {message.hasAttachment && message.attachmentName && (
            <div className="flex items-center gap-1.5 text-[11px] text-text-tertiary">
              <Paperclip className="h-3 w-3 shrink-0" />
              <span className="truncate max-w-[200px]">{message.attachmentName}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Assistant message
  const parsed = parseAIResponse(message.content);

  return (
    <div className="flex justify-start mb-5 animate-fade-in">
      <div className="max-w-[92%] w-full">
        {/* Avatar row */}
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="h-7 w-7 rounded-lg gradient-coral flex items-center justify-center shrink-0 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-xs text-text-secondary font-semibold">Slides AI</span>
          {message.isStreaming && (
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5">
                <div className="h-1.5 w-1.5 rounded-full bg-coral animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="h-1.5 w-1.5 rounded-full bg-coral animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="h-1.5 w-1.5 rounded-full bg-coral animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="ml-9">
          {/* AskUserQuestion tool call */}
          {message.toolCallId && message.toolCallInput && (() => {
            let questions: AskUserQuestion[] = [];
            try {
              const parsed = JSON.parse(message.toolCallInput) as { questions: AskUserQuestion[] };
              questions = parsed.questions ?? [];
            } catch {
              // malformed JSON — fall through to text render below
            }
            if (questions.length === 0) return null;

            // Already answered — show read-only summary with selections frozen
            if (answeredSelections) {
              return (
                <>
                  {message.content && (
                    <div className="text-sm leading-relaxed text-text-primary whitespace-pre-wrap mb-3 bg-surface-elevated rounded-2xl rounded-tl-md px-4 py-3 border border-border-light shadow-card">
                      {message.content}
                    </div>
                  )}
                  <div className="bg-surface-elevated border border-border-light rounded-2xl rounded-tl-md overflow-hidden shadow-card">
                    {questions.map((q, qIdx) => {
                      const raw = answeredSelections[qIdx] ?? "";
                      const selected = raw ? raw.split(",").map((s) => s.trim()) : [];
                      return (
                        <div key={qIdx} className={`px-4 py-3 ${qIdx < questions.length - 1 ? "border-b border-border-light" : ""}`}>
                          <p className="text-xs text-text-tertiary mb-2">{q.header}: {q.question}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {q.options.map((opt) => (
                              <span
                                key={opt.label}
                                className={selected.includes(opt.label)
                                  ? "text-xs px-2.5 py-1 rounded-lg bg-coral/10 text-coral font-semibold"
                                  : "text-xs px-2.5 py-1 rounded-lg bg-surface text-text-tertiary"
                                }
                              >
                                {selected.includes(opt.label) ? "✓ " : ""}{opt.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            }

            // Unanswered — interactive card
            return (
              <>
                {message.content && (
                  <div className="text-sm leading-relaxed text-text-primary whitespace-pre-wrap mb-3 bg-surface-elevated rounded-2xl rounded-tl-md px-4 py-3 border border-border-light shadow-card">
                    {message.content}
                  </div>
                )}
                <AskUserQuestionCard
                  questions={questions}
                  currentQuestionIdx={currentQuestionIdx ?? 0}
                  pendingAnswers={pendingAnswers ?? {}}
                  onAnswer={onAnswer ?? (() => { })}
                  onNext={onNext ?? (() => { })}
                  onSubmit={onSubmit ?? (() => { })}
                  disabled={questionDisabled}
                />
              </>
            );
          })()}

          {/* Normal text/stylePreviews/finalPresentation — only if no tool call */}
          {!message.toolCallId && (
            <>
              {parsed.type === "text" && (
                <div className="text-sm leading-relaxed text-text-primary whitespace-pre-wrap bg-surface-elevated rounded-2xl rounded-tl-md px-4 py-3 border border-border-light shadow-card">
                  {message.content}
                  {message.isStreaming && (
                    <span className="inline-block w-[2px] h-3.5 bg-coral animate-pulse ml-0.5 rounded-full" />
                  )}
                </div>
              )}

              {parsed.type === "stylePreviews" && (
                <>
                  {message.content.split("```html")[0].trim() && (
                    <div className="text-sm leading-relaxed text-text-primary whitespace-pre-wrap mb-4 bg-surface-elevated rounded-2xl rounded-tl-md px-4 py-3 border border-border-light shadow-card">
                      {message.content.split("```html")[0].trim()}
                    </div>
                  )}
                  {!message.isStreaming && onStyleSelect && (
                    <StylePreviewGrid
                      previews={parsed.previews}
                      names={parsed.names}
                      onSelect={onStyleSelect}
                      disabled={styleSelectDisabled}
                    />
                  )}
                  {message.isStreaming && (
                    <div className="text-sm text-text-secondary flex items-center gap-2 bg-surface-elevated rounded-2xl px-4 py-3 border border-border-light">
                      <Loader2 className="h-4 w-4 animate-spin text-coral" />
                      Generating style previews…
                    </div>
                  )}
                </>
              )}

              {parsed.type === "finalPresentation" && (
                <>
                  {parsed.textBefore && (
                    <div className="text-sm leading-relaxed text-text-primary whitespace-pre-wrap mb-4 bg-surface-elevated rounded-2xl rounded-tl-md px-4 py-3 border border-border-light shadow-card">
                      {parsed.textBefore}
                    </div>
                  )}
                  {message.isStreaming ? (
                    <div className="text-sm text-text-secondary flex items-center gap-2 bg-surface-elevated rounded-2xl px-4 py-3 border border-border-light">
                      <Loader2 className="h-4 w-4 animate-spin text-coral" />
                      Generating your presentation…
                    </div>
                  ) : presentation ? (
                    <PresentationCard
                      slug={presentation.slug}
                      title={presentation.title}
                      htmlContent={presentation.htmlContent}
                      showFullscreen={showFullscreen}
                    />
                  ) : (
                    <div className="text-sm text-text-secondary flex items-center gap-2 bg-surface-elevated rounded-2xl px-4 py-3 border border-border-light">
                      <Loader2 className="h-4 w-4 animate-spin text-coral" />
                      Saving your presentation…
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
