import { Loader2, Palette, Check } from "lucide-react";
import { AskUserQuestionCard } from "./AskUserQuestionCard";
import type { AskUserQuestion } from "./AskUserQuestionCard";

interface Message {
  _id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming: boolean;
  hasThemeResult: boolean;
  toolCallId?: string;
  toolCallInput?: string;
  toolResultFor?: string;
}

interface GeneratedTheme {
  _id: string;
  name: string;
  colors: {
    background: string;
    foreground: string;
    accent: string;
    accentForeground: string;
    muted: string;
    mutedForeground: string;
    surface: string;
    surfaceForeground: string;
    border: string;
  };
  fonts: {
    display: string;
    body: string;
  };
  spacing: string;
  previewHtml?: string;
}

interface ThemeChatMessageProps {
  message: Message;
  generatedTheme?: GeneratedTheme;
  currentQuestionIdx?: number;
  pendingAnswers?: Record<number, string>;
  onAnswer?: (questionIdx: number, label: string) => void;
  onNext?: () => void;
  onSubmit?: () => void;
  questionDisabled?: boolean;
  answeredSelections?: string[];
}

export function ThemeChatMessage({
  message,
  generatedTheme,
  currentQuestionIdx,
  pendingAnswers,
  onAnswer,
  onNext,
  onSubmit,
  questionDisabled = false,
  answeredSelections,
}: ThemeChatMessageProps) {
  // Hidden tool result messages
  if (message.toolResultFor) return null;

  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end mb-5 animate-scale-in">
        <div className="max-w-[78%]">
          <div className="rounded-2xl rounded-tr-md bg-coral text-white px-4 py-3 text-sm leading-relaxed shadow-sm">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex justify-start mb-5 animate-fade-in">
      <div className="max-w-[92%] w-full">
        {/* Avatar row */}
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="h-7 w-7 rounded-lg gradient-coral flex items-center justify-center shrink-0 shadow-sm">
            <Palette className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-xs text-text-secondary font-semibold">
            Theme Designer
          </span>
          {message.isStreaming && (
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5">
                <div
                  className="h-1.5 w-1.5 rounded-full bg-coral animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <div
                  className="h-1.5 w-1.5 rounded-full bg-coral animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <div
                  className="h-1.5 w-1.5 rounded-full bg-coral animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="ml-9">
          {/* AskUserQuestion tool call */}
          {message.toolCallId &&
            message.toolCallInput &&
            (() => {
              let questions: AskUserQuestion[] = [];
              try {
                const parsed = JSON.parse(message.toolCallInput) as {
                  questions: AskUserQuestion[];
                };
                questions = parsed.questions ?? [];
              } catch {
                // malformed JSON
              }
              if (questions.length === 0) return null;

              // Already answered — show read-only summary
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
                        const selected = raw
                          ? raw.split(",").map((s) => s.trim())
                          : [];
                        return (
                          <div
                            key={qIdx}
                            className={`px-4 py-3 ${qIdx < questions.length - 1 ? "border-b border-border-light" : ""}`}
                          >
                            <p className="text-xs text-text-tertiary mb-2">
                              {q.header}: {q.question}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {q.options.map((opt) => (
                                <span
                                  key={opt.label}
                                  className={
                                    selected.includes(opt.label)
                                      ? "text-xs px-2.5 py-1 rounded-lg bg-coral/10 text-coral font-semibold"
                                      : "text-xs px-2.5 py-1 rounded-lg bg-surface text-text-tertiary"
                                  }
                                >
                                  {selected.includes(opt.label) ? "✓ " : ""}
                                  {opt.label}
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
                    onAnswer={onAnswer ?? (() => {})}
                    onNext={onNext ?? (() => {})}
                    onSubmit={onSubmit ?? (() => {})}
                    disabled={questionDisabled}
                  />
                </>
              );
            })()}

          {/* Normal text or theme result */}
          {!message.toolCallId && (
            <>
              {message.hasThemeResult && generatedTheme ? (
                <>
                  {/* Extract text before JSON (if any) */}
                  {extractTextBeforeJson(message.content) && (
                    <div className="text-sm leading-relaxed text-text-primary whitespace-pre-wrap mb-4 bg-surface-elevated rounded-2xl rounded-tl-md px-4 py-3 border border-border-light shadow-card">
                      {extractTextBeforeJson(message.content)}
                    </div>
                  )}
                  {/* Theme card */}
                  <div className="bg-surface-elevated border border-border-light rounded-2xl overflow-hidden shadow-card">
                    {/* Preview */}
                    {generatedTheme.previewHtml && (
                      <div className="aspect-video border-b border-border-light">
                        <iframe
                          srcDoc={generatedTheme.previewHtml}
                          sandbox="allow-scripts"
                          className="w-full h-full"
                          title="Theme preview"
                        />
                      </div>
                    )}
                    {/* Info */}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-text-primary">
                          {generatedTheme.name}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                          <Check className="h-3 w-3" />
                          Saved
                        </div>
                      </div>
                      {/* Color swatches */}
                      <div className="flex items-center gap-1.5 mb-3">
                        {Object.entries(generatedTheme.colors)
                          .slice(0, 6)
                          .map(([key, color]) => (
                            <div
                              key={key}
                              className="h-6 w-6 rounded-full border border-border-light shadow-sm"
                              style={{ backgroundColor: color }}
                              title={key}
                            />
                          ))}
                      </div>
                      {/* Fonts */}
                      <p className="text-xs text-text-secondary">
                        <span className="font-medium">Fonts:</span>{" "}
                        {generatedTheme.fonts.display} +{" "}
                        {generatedTheme.fonts.body}
                      </p>
                    </div>
                  </div>
                </>
              ) : message.isStreaming && message.hasThemeResult ? (
                <div className="text-sm text-text-secondary flex items-center gap-2 bg-surface-elevated rounded-2xl px-4 py-3 border border-border-light">
                  <Loader2 className="h-4 w-4 animate-spin text-coral" />
                  Generating your theme...
                </div>
              ) : (
                <div className="text-sm leading-relaxed text-text-primary whitespace-pre-wrap bg-surface-elevated rounded-2xl rounded-tl-md px-4 py-3 border border-border-light shadow-card">
                  {message.content}
                  {message.isStreaming && (
                    <span className="inline-block w-0.5 h-3.5 bg-coral animate-pulse ml-0.5 rounded-full" />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper to extract text before JSON block
function extractTextBeforeJson(content: string): string {
  const jsonStart = content.indexOf("{");
  if (jsonStart === -1) return content;
  const textBefore = content.slice(0, jsonStart).trim();
  // Remove any markdown code fence markers
  return textBefore.replace(/```json?\s*$/i, "").trim();
}
