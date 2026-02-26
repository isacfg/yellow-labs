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
  const [smartEditMode, setSmartEditMode] = useState(false);

  // Auto-scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isStreaming = messages.some((m: (typeof messages)[number]) => m.isStreaming);

  const { lastUnansweredToolCallId, answeredToolCallResults } = useMemo(() => {
    // Build map: toolCallId → selected labels array (from stored tool result messages)
    const results: Record<string, string[]> = {};
    const answeredIds = new Set<string | undefined>();
    for (const m of messages) {
      if (m.toolResultFor && m.content) {
        results[m.toolResultFor] = m.content.split("\n").filter(Boolean);
        answeredIds.add(m.toolResultFor);
      }
    }
    const toolCallMsgs = messages.filter(
      (m: (typeof messages)[number]) => m.toolCallId && !answeredIds.has(m.toolCallId)
    );
    return {
      lastUnansweredToolCallId: toolCallMsgs.at(-1)?._id ?? null,
      answeredToolCallResults: results,
    };
  }, [messages]);

  const handleSend = async (
    content: string,
    attachment?: {
      name: string;
      pageImages: { data: string; mediaType: string }[];
      textContent?: string;
    },
  ) => {
    if (isSending || isStreaming) return;
    setIsSending(true);
    try {
      await sendMessage({
        conversationId,
        userContent: content,
        attachmentImages: attachment?.pageImages,
        attachmentName: attachment?.name,
        attachmentText: attachment?.textContent,
        smartEditMode: smartEditMode || undefined,
      });
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
        {(() => {
          // Pre-compute outside the per-message loop
          const finalPresentationMessages = messages.filter(
            (m: (typeof messages)[number]) => m.hasFinalPresentation
          );
          const lastFinalPresentationId = finalPresentationMessages.at(-1)?._id;

          const stylePreviewMsgs = messages.filter(
            (m: (typeof messages)[number]) => m.hasStylePreviews
          );
          const lastStylePreviewId = stylePreviewMsgs.at(-1)?._id;

          return messages.map((msg: (typeof messages)[number]) => {
            const isLastStylePreview =
              msg.hasStylePreviews && msg._id === lastStylePreviewId;

            const isLastFinalPresentation =
              msg.hasFinalPresentation && msg._id === lastFinalPresentationId;

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
                showFullscreen={isLastFinalPresentation}
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
                answeredSelections={
                  msg.toolCallId && answeredToolCallResults[msg.toolCallId]
                    ? answeredToolCallResults[msg.toolCallId]
                    : undefined
                }
              />
            );
          });
        })()}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <MessageInput
        onSend={handleSend}
        disabled={isSending || isStreaming}
        placeholder={
          messages.length === 0
            ? "Describe your presentation topic, audience, and goals..."
            : smartEditMode
              ? "Describe the change you want (e.g., 'change slide 2 heading to...')"
              : "Continue the conversation..."
        }
        hasPresentation={!!presentation}
        smartEditMode={smartEditMode}
        onToggleSmartEdit={() => setSmartEditMode((m) => !m)}
      />
    </div>
  );
}
