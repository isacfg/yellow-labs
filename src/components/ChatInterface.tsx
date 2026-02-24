import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ChatMessage } from "./ChatMessage";
import { MessageInput } from "./MessageInput";

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
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isSending, setIsSending] = useState(false);
  const [styleSelectDisabled, setStyleSelectDisabled] = useState(false);

  // Auto-scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isStreaming = messages.some((m: (typeof messages)[number]) => m.isStreaming);

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

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-12">
            <p className="text-4xl mb-4">✨</p>
            <p className="font-medium mb-1">Tell me about your presentation</p>
            <p>What's the topic, audience, and tone you're going for?</p>
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
              styleSelectDisabled={
                styleSelectDisabled || isSending || isStreaming
              }
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
