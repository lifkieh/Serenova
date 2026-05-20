import React from "react";

type InputBarProps = {
  message: string;
  isSending: boolean;
  isOffline: boolean;
  lang: "en" | "id";
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (text: string) => void;
  onSend: () => void;
  placeholder?: string;
};

export default function InputBar({
  message,
  isSending,
  isOffline,
  lang,
  textareaRef,
  onChange,
  onSend,
  placeholder
}: InputBarProps) {
  const sendLabel = lang === "id" ? "Kirim" : "Send";
  const defaultPlaceholder = lang === "id" ? "Cerita ke Serenova..." : "Talk to Serenova...";
  const privacyText = lang === "id"
    ? "Percakapan diproses secara privat. Hindari berbagi informasi sensitif."
    : "Conversations are kept safe and private. Avoid sharing highly sensitive keys.";

  return (
    <div className="p-4 bg-zinc-950/50 border-t border-white/10 flex flex-col gap-2 shrink-0">
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          rows={1}
          value={message}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 768) {
              e.preventDefault();
              if (!isSending) {
                onSend();
              }
            }
          }}
          placeholder={placeholder || defaultPlaceholder}
          disabled={isSending || isOffline}
          className="flex-1 bg-zinc-900 border border-white/10 rounded-xl p-3 outline-none disabled:opacity-50 text-sm text-zinc-100 placeholder-zinc-500 resize-none max-h-32 min-h-[44px] transition-all scrollbar-none"
        />

        <button
          onClick={onSend}
          disabled={isSending || isOffline || !message.trim()}
          className="bg-zinc-100 hover:bg-white text-black text-xs font-semibold px-5 h-11 rounded-xl disabled:opacity-40 disabled:hover:bg-zinc-100 transition-all select-none flex items-center justify-center shrink-0"
        >
          {sendLabel}
        </button>
      </div>

      <p className="text-[9px] text-zinc-700 text-center select-none pt-1">
        {privacyText}
      </p>
    </div>
  );
}
