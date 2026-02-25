import { useState, useRef, type KeyboardEvent } from "react";
import { Send, Loader2, Sparkles, Paperclip, X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  extractFileImages,
  type AttachmentImages,
} from "@/lib/extractFileImages";

const LUCKY_PROMPTS = [
  "Uma apresentação sobre por que gatos são melhores chefes que humanos",
  "Como sobreviver a uma reunião de segunda-feira sem café",
  "10 razões pelas quais o Wi-Fi é a invenção mais importante da humanidade",
  "O guia definitivo para fingir que você entendeu a reunião",
  "Por que procrastinar é na verdade uma forma de arte",
  "Como parecer ocupado enquanto não faz absolutamente nada",
  "Pizza vs. Reuniões: qual desperdiça mais tempo?",
  "O ciclo de vida de uma ideia em uma empresa: do entusiasmo ao esquecimento",
  "Por que segunda-feira deveria ser abolida por lei",
  "Como transformar qualquer desastre em 'era o plano desde o início'",
  "O guia completo para enviar e-mails que ninguém vai ler",
  "Slides sobre slides: a meta-apresentação definitiva",
  "Por que o botão de snooze foi a melhor invenção do século XX",
  "Como sobreviver a um apocalipse zumbi usando só metodologia ágil",
  "5 técnicas para parecer sério em videoconferência enquanto está de pijama",
];

interface MessageInputProps {
  onSend: (
    content: string,
    attachment?: {
      name: string;
      pageImages: { data: string; mediaType: string }[];
    },
  ) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({
  onSend,
  disabled = false,
  placeholder = "Describe your presentation…",
}: MessageInputProps) {
  const [value, setValue] = useState("");
  const [attachment, setAttachment] = useState<AttachmentImages | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (disabled) return;
    if (!trimmed && !attachment) return;
    onSend(trimmed || "Here is my file for reference.", attachment ?? undefined);
    setValue("");
    setAttachment(null);
    setExtractError(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const canSend = !disabled && (value.trim().length > 0 || attachment !== null);

  const handleLucky = () => {
    if (disabled) return;
    const prompt =
      LUCKY_PROMPTS[Math.floor(Math.random() * LUCKY_PROMPTS.length)];
    setValue(prompt);
    setTimeout(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
      el.focus();
    }, 0);
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset the input so the same file can be re-selected
    e.target.value = "";
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setIsExtracting(true);
    setExtractError(null);
    try {
      const result = await extractFileImages(file);
      setAttachment(result);
    } catch (err) {
      setExtractError(
        err instanceof Error ? err.message : "Failed to extract file",
      );
    } finally {
      setIsExtracting(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const imageItems = Array.from(e.clipboardData.items).filter(
      (item) => item.type.startsWith("image/"),
    );
    if (imageItems.length === 0) return;
    e.preventDefault();

    setIsExtracting(true);
    setExtractError(null);
    try {
      const newImages = await Promise.all(
        imageItems.map(async (item) => {
          const file = item.getAsFile();
          if (!file) return null;
          const { pageImages } = await extractFileImages(file);
          return pageImages[0] ?? null;
        }),
      );
      const valid = newImages.filter(Boolean) as { data: string; mediaType: string }[];
      if (valid.length === 0) return;

      setAttachment((prev) => {
        const merged = [...(prev?.pageImages ?? []), ...valid];
        const name = merged.map((_, i) => `image ${i + 1}`).join(", ");
        return { name, pageImages: merged };
      });
    } catch (err) {
      setExtractError(
        err instanceof Error ? err.message : "Failed to paste image",
      );
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="px-6 pb-6 pt-3 bg-surface border-t border-border-light">
      <div className="max-w-3xl mx-auto">
        {/* Attachment preview strip */}
        {attachment && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="flex items-center gap-1.5 bg-surface-elevated border border-border-light rounded-lg px-2.5 py-1.5 text-xs text-text-secondary">
              <FileText className="h-3 w-3 text-coral shrink-0" />
              <span className="truncate max-w-[200px]">{attachment.name}</span>
              <span className="text-text-tertiary">
                ({attachment.pageImages.length}{" "}
                {attachment.pageImages.length === 1 ? "page" : "pages"})
              </span>
              <button
                onClick={() => setAttachment(null)}
                className="ml-0.5 p-0.5 rounded hover:bg-surface hover:text-text-primary transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}

        {/* Extraction error */}
        {extractError && (
          <div className="flex items-center gap-2 mb-2 px-1 text-xs text-red-400">
            {extractError}
          </div>
        )}

        <div className="flex items-end gap-3 bg-surface-elevated rounded-2xl border border-border-light shadow-card px-4 py-3 focus-within:border-coral/30 focus-within:shadow-[0_0_0_3px_rgba(255,90,61,0.08)] transition-all duration-200">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            onPaste={handlePaste}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              "flex-1 resize-none bg-transparent text-sm leading-relaxed",
              "placeholder:text-text-tertiary",
              "focus:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-40",
              "min-h-[24px] max-h-[200px] overflow-y-auto",
              "text-text-primary",
            )}
          />
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.pptx,.png,.jpg,.jpeg"
            onChange={handleFileChange}
            className="hidden"
          />
          {/* Paperclip button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isExtracting}
            title="Attach a file (PDF, PPTX, or image)"
            className={cn(
              "h-8 w-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200",
              !disabled && !isExtracting
                ? "bg-surface border border-border-light text-text-secondary hover:border-coral/40 hover:text-coral hover:shadow-sm"
                : "opacity-30 cursor-not-allowed text-text-tertiary",
            )}
          >
            {isExtracting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Paperclip className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={handleLucky}
            disabled={disabled}
            title="I'm feeling lucky"
            className={cn(
              "h-8 px-2.5 rounded-xl flex items-center gap-1.5 shrink-0 transition-all duration-200 text-[11px] font-medium whitespace-nowrap",
              !disabled
                ? "bg-surface border border-border-light text-text-secondary hover:border-coral/40 hover:text-coral hover:shadow-sm"
                : "opacity-30 cursor-not-allowed text-text-tertiary",
            )}
          >
            <Sparkles className="h-3 w-3" />
            Lucky
          </button>
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={cn(
              "h-8 w-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200",
              canSend
                ? "gradient-coral text-white shadow-sm hover:shadow-glow-coral hover:scale-105"
                : "bg-surface text-text-tertiary cursor-not-allowed",
            )}
          >
            {disabled ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="text-center text-[10px] text-text-tertiary mt-2">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
