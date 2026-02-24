import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ChatMessage } from "./ChatMessage";
import { MessageInput } from "./MessageInput";
import { Sparkles } from "lucide-react";

interface ChatInterfaceProps {
  conversationId: Id<"conversations">;
}

export function ChatInterface({ conversationId }: ChatInterfaceProps) {
  const rawMessages = useQuery(api.messages.list, { conversationId });
  const messages = useMemo(() => rawMessages ?? [], [rawMessages]);
  const presentation = useQuery(api.presentations.getByConversation, {
    conversationId,
  });
  const sendMessage = useAction(api.ai.sendMessage);
  const answerQuestion = useAction(api.ai.answerQuestion);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isSending, setIsSending] = useState(false);
  const [styleSelectDisabled, setStyleSelectDisabled] = useState(false);
  const [pendingAnswers, setPendingAnswers] = useState<Record<number, string>>({});
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);

  // Auto-scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isStreaming = messages.some((m: (typeof messages)[number]) => m.isStreaming);

  const lastUnansweredToolCallId = useMemo(() => {
    const answeredIds = new Set(
      messages
        .filter((m: (typeof messages)[number]) => m.toolResultFor)
        .map((m: (typeof messages)[number]) => m.toolResultFor)
    );
    const toolCallMsgs = messages.filter(
      (m: (typeof messages)[number]) => m.toolCallId && !answeredIds.has(m.toolCallId)
    );
    return toolCallMsgs.at(-1)?._id ?? null;
  }, [messages]);

  const handleSend = async (content: string) => {
    if (isSending || isStreaming) return;
    setIsSending(true);
    try {
      await sendMessage({ conversationId, userContent: content });
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleStyleSelect = async (index: number) => {
    setStyleSelectDisabled(true);
    await handleSend(`I choose option ${index + 1}`);
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
      // Reset only after successful submission
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
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-xl font-bold mb-2 tracking-tight">
              What will you present today?
            </h2>
            <p className="text-text-secondary text-sm max-w-xs leading-relaxed">
              Describe your topic, audience, and goals — I'll create something beautiful.
            </p>
          </div>
        )}
        {messages.map((msg: (typeof messages)[number]) => {
          const isLastStylePreview =
            msg.hasStylePreviews &&
            messages.filter((m: (typeof messages)[number]) => m.hasStylePreviews).at(-1)?._id === msg._id;

          return (
            <ChatMessage
              key={msg._id}
              message={msg}
              presentation={
                msg.hasFinalPresentation && !msg.isStreaming && presentation
                  ? presentation
                  : undefined
              }
              onStyleSelect={isLastStylePreview ? handleStyleSelect : undefined}
              styleSelectDisabled={styleSelectDisabled || isSending || isStreaming}
              currentQuestionIdx={msg._id === lastUnansweredToolCallId ? currentQuestionIdx : 0}
              pendingAnswers={msg._id === lastUnansweredToolCallId ? pendingAnswers : {}}
              onAnswer={msg._id === lastUnansweredToolCallId ? handleAnswer : undefined}
              onNext={msg._id === lastUnansweredToolCallId ? handleNext : undefined}
              onSubmit={
                msg._id === lastUnansweredToolCallId && msg.toolCallId
                  ? () => handleSubmitAnswers(msg.toolCallId!)
                  : undefined
              }
              questionDisabled={isSending || isStreaming}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <MessageInput
        onSend={handleSend}
        disabled={isSending || isStreaming}
        placeholder={
          messages.length === 0
            ? "Describe your presentation topic, audience, and goals..."
            : "Continue the conversation..."
        }
      />
    </div>
  );
}
