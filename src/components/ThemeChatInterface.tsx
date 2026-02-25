import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ThemeChatMessage } from "@/components/ThemeChatMessage";
import { Send, Palette } from "lucide-react";

interface ThemeChatInterfaceProps {
  conversationId: Id<"themeConversations">;
  onThemeCreated?: (themeId: Id<"themes">) => void;
}

export function ThemeChatInterface({
  conversationId,
  onThemeCreated,
}: ThemeChatInterfaceProps) {
  const conversation = useQuery(api.themeConversations.get, { conversationId });
  const rawMessages = useQuery(api.themeConversations.listMessages, {
    conversationId,
  });
  const messages = useMemo(() => rawMessages ?? [], [rawMessages]);
  const generatedTheme = useQuery(
    api.themes.get,
    conversation?.generatedThemeId
      ? { themeId: conversation.generatedThemeId }
      : "skip"
  );
  const sendMessage = useAction(api.ai.sendThemeMessage);
  const answerQuestion = useAction(api.ai.answerThemeQuestion);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [pendingAnswers, setPendingAnswers] = useState<Record<number, string>>(
    {}
  );
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);

  // Auto-scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Notify parent when theme is created
  useEffect(() => {
    if (conversation?.generatedThemeId && onThemeCreated) {
      onThemeCreated(conversation.generatedThemeId);
    }
  }, [conversation?.generatedThemeId, onThemeCreated]);

  const isStreaming = messages.some(
    (m: (typeof messages)[number]) => m.isStreaming
  );

  const { lastUnansweredToolCallId, answeredToolCallResults } = useMemo(() => {
    const results: Record<string, string[]> = {};
    const answeredIds = new Set<string | undefined>();
    for (const m of messages) {
      if (m.toolResultFor && m.content) {
        results[m.toolResultFor] = m.content.split("\n").filter(Boolean);
        answeredIds.add(m.toolResultFor);
      }
    }
    const toolCallMsgs = messages.filter(
      (m: (typeof messages)[number]) =>
        m.toolCallId && !answeredIds.has(m.toolCallId)
    );
    return {
      lastUnansweredToolCallId: toolCallMsgs.at(-1)?._id ?? null,
      answeredToolCallResults: results,
    };
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isSending || isStreaming) return;
    const content = input.trim();
    setInput("");
    setIsSending(true);
    try {
      await sendMessage({
        conversationId,
        userContent: content,
      });
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleAnswer = (questionIdx: number, label: string) => {
    setPendingAnswers((prev) => ({ ...prev, [questionIdx]: label }));
  };

  const handleNext = () => {
    setCurrentQuestionIdx((i) => i + 1);
  };

  const handleSubmitAnswers = async (toolCallId: string) => {
    const answersText = Object.entries(pendingAnswers)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, label]) => label)
      .join("\n");

    setIsSending(true);
    try {
      await answerQuestion({
        conversationId,
        toolCallId,
        answers: answersText,
      });
      setPendingAnswers({});
      setCurrentQuestionIdx(0);
    } catch (err) {
      console.error("Failed to submit answers:", err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-8 max-w-3xl mx-auto w-full">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <div className="h-14 w-14 rounded-2xl gradient-coral flex items-center justify-center mb-5 shadow-glow-coral">
              <Palette className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-xl font-bold mb-2 tracking-tight">
              Let's design your perfect theme
            </h2>
            <p className="text-text-secondary text-sm max-w-xs leading-relaxed mb-6">
              Tell me about your ideal presentation style and I'll create a
              custom theme just for you
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                "Create a theme for me",
                "I need something professional",
                "Something creative and bold",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion);
                    inputRef.current?.focus();
                  }}
                  className="px-4 py-2 text-sm bg-surface-elevated border border-border-light rounded-xl hover:border-coral/40 transition-all cursor-pointer text-text-secondary hover:text-text-primary"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg: (typeof messages)[number]) => {
          const isLastUnanswered = msg._id === lastUnansweredToolCallId;
          return (
            <ThemeChatMessage
              key={msg._id}
              message={msg}
              generatedTheme={
                msg.hasThemeResult && !msg.isStreaming && generatedTheme
                  ? generatedTheme
                  : undefined
              }
              currentQuestionIdx={isLastUnanswered ? currentQuestionIdx : 0}
              pendingAnswers={isLastUnanswered ? pendingAnswers : {}}
              onAnswer={isLastUnanswered ? handleAnswer : undefined}
              onNext={isLastUnanswered ? handleNext : undefined}
              onSubmit={
                isLastUnanswered && msg.toolCallId
                  ? () => handleSubmitAnswers(msg.toolCallId!)
                  : undefined
              }
              questionDisabled={isSending || isStreaming}
              answeredSelections={
                msg.toolCallId && answeredToolCallResults[msg.toolCallId]
                  ? answeredToolCallResults[msg.toolCallId]
                  : undefined
              }
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border-light bg-surface px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                messages.length === 0
                  ? "Describe your ideal theme style..."
                  : "Continue the conversation..."
              }
              disabled={isSending || isStreaming}
              className="flex-1 bg-surface-elevated border border-border-light rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-coral focus:ring-1 focus:ring-coral/20 transition-all disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isSending || isStreaming}
              className="h-11 w-11 rounded-xl gradient-coral flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-all shadow-sm cursor-pointer"
            >
              {isSending || isStreaming ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
