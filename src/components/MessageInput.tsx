import { useState, useRef, type KeyboardEvent } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

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
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({
  onSend,
  disabled = false,
  placeholder = "Describe your presentation…",
}: MessageInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
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

  const canSend = !disabled && value.trim().length > 0;

  const handleLucky = () => {
    if (disabled) return;
    const prompt = LUCKY_PROMPTS[Math.floor(Math.random() * LUCKY_PROMPTS.length)];
    setValue(prompt);
    textareaRef.current?.focus();
  };

  return (
    <div className="px-6 pb-6 pt-3 bg-surface border-t border-border-light">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-3 bg-surface-elevated rounded-2xl border border-border-light shadow-card px-4 py-3 focus-within:border-coral/30 focus-within:shadow-[0_0_0_3px_rgba(255,90,61,0.08)] transition-all duration-200">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              "flex-1 resize-none bg-transparent text-sm leading-relaxed",
              "placeholder:text-text-tertiary",
              "focus:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-40",
              "min-h-[24px] max-h-[200px] overflow-y-auto",
              "text-text-primary"
            )}
          />
          <button
            onClick={handleLucky}
            disabled={disabled}
            title="I'm feeling lucky"
            className={cn(
              "h-8 px-2.5 rounded-xl flex items-center gap-1.5 shrink-0 transition-all duration-200 text-[11px] font-medium whitespace-nowrap",
              !disabled
                ? "bg-surface border border-border-light text-text-secondary hover:border-coral/40 hover:text-coral hover:shadow-sm"
                : "opacity-30 cursor-not-allowed text-text-tertiary"
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
                : "bg-surface text-text-tertiary cursor-not-allowed"
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
