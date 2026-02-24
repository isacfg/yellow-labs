import { parseAIResponse } from "@/lib/parseAIResponse";
import { StylePreviewGrid } from "./StylePreviewGrid";
import { PresentationCard } from "./PresentationCard";
import { Loader2 } from "lucide-react";

interface Message {
  _id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming: boolean;
  hasStylePreviews: boolean;
  hasFinalPresentation: boolean;
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
}

export function ChatMessage({
  message,
  presentation,
  onStyleSelect,
  styleSelectDisabled = false,
}: ChatMessageProps) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm">
          {message.content}
        </div>
      </div>
    );
  }

  // Assistant message
  const parsed = parseAIResponse(message.content);

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[90%] w-full">
        {/* Avatar */}
        <div className="flex items-center gap-2 mb-1">
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
            S
          </div>
          <span className="text-xs text-muted-foreground">Slides AI</span>
          {message.isStreaming && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Content */}
        <div className="ml-8">
          {parsed.type === "text" && (
            <div className="text-sm whitespace-pre-wrap text-foreground leading-relaxed">
              {message.content}
              {message.isStreaming && (
                <span className="inline-block w-2 h-4 bg-foreground/50 animate-pulse ml-0.5" />
              )}
            </div>
          )}

          {parsed.type === "stylePreviews" && (
            <>
              {/* Show any text before the code blocks */}
              {message.content.split("```html")[0].trim() && (
                <div className="text-sm whitespace-pre-wrap text-foreground leading-relaxed mb-3">
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
                <div className="text-sm text-muted-foreground italic">
                  Generating style previews...
                  <Loader2 className="inline h-3 w-3 animate-spin ml-1" />
                </div>
              )}
            </>
          )}

          {parsed.type === "finalPresentation" && (
            <>
              {parsed.textBefore && (
                <div className="text-sm whitespace-pre-wrap text-foreground leading-relaxed mb-3">
                  {parsed.textBefore}
                </div>
              )}
              {message.isStreaming ? (
                <div className="text-sm text-muted-foreground italic">
                  Generating your presentation...
                  <Loader2 className="inline h-3 w-3 animate-spin ml-1" />
                </div>
              ) : presentation ? (
                <PresentationCard
                  slug={presentation.slug}
                  title={presentation.title}
                  htmlContent={presentation.htmlContent}
                />
              ) : (
                <div className="text-sm text-muted-foreground">
                  Saving your presentation...
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
