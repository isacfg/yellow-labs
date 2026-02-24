import { parseAIResponse } from "@/lib/parseAIResponse";
import { StylePreviewGrid } from "./StylePreviewGrid";
import { PresentationCard } from "./PresentationCard";
import { Loader2, Sparkles } from "lucide-react";
import { AskUserQuestionCard } from "./AskUserQuestionCard";
import type { AskUserQuestion } from "./AskUserQuestionCard";

interface Message {
  _id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming: boolean;
  hasStylePreviews: boolean;
  hasFinalPresentation: boolean;
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
  // AskUserQuestion props
  currentQuestionIdx?: number;
  pendingAnswers?: Record<number, string>;
  onAnswer?: (questionIdx: number, label: string) => void;
  onNext?: () => void;
  onSubmit?: () => void;
  questionDisabled?: boolean;
}

export function ChatMessage({
  message,
  presentation,
  onStyleSelect,
  styleSelectDisabled = false,
  currentQuestionIdx,
  pendingAnswers,
  onAnswer,
  onNext,
  onSubmit,
  questionDisabled = false,
}: ChatMessageProps) {
  // Hidden tool result messages — only exist for conversation history
  if (message.toolResultFor) return null;

  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end mb-5 animate-scale-in">
        <div className="max-w-[78%] rounded-2xl rounded-tr-md bg-coral text-white px-4 py-3 text-sm leading-relaxed shadow-sm">
          {message.content}
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
          {/* AskUserQuestion tool call — render as interactive question card */}
          {message.toolCallId && message.toolCallInput && (() => {
            let questions: AskUserQuestion[] = [];
            try {
              const parsed = JSON.parse(message.toolCallInput) as { questions: AskUserQuestion[] };
              questions = parsed.questions ?? [];
            } catch {
              // malformed JSON — fall through to text render below
            }
            if (questions.length > 0) {
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
                    onAnswer={onAnswer ?? (() => {})}
                    onNext={onNext ?? (() => {})}
                    onSubmit={onSubmit ?? (() => {})}
                    disabled={questionDisabled}
                  />
                </>
              );
            }
            return null;
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
