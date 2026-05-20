import React from "react";
import { StopCircle } from "lucide-react";

type MessageBubbleProps = {
  message: { id?: string; role: string; content: string };
  lang: "en" | "id";
  submittedMessageIds: string[];
  activeFeedbackMessageId: string | null;
  feedbackType: string;
  feedbackTag: string;
  optionalText: string;
  onPrimaryFeedbackClick: (msgId: string, type: string) => void;
  onFeedbackTagChange: (tag: string) => void;
  onOptionalTextChange: (text: string) => void;
  onFeedbackCancel: () => void;
  onFeedbackSubmit: (msgId: string) => void;
  isTypingIndicator?: boolean;
  onStopStreaming?: () => void;
  renderContent?: (content: string) => React.ReactNode;
};

export default function MessageBubble({
  message,
  lang,
  submittedMessageIds,
  activeFeedbackMessageId,
  feedbackType,
  feedbackTag,
  optionalText,
  onPrimaryFeedbackClick,
  onFeedbackTagChange,
  onOptionalTextChange,
  onFeedbackCancel,
  onFeedbackSubmit,
  isTypingIndicator,
  onStopStreaming,
  renderContent
}: MessageBubbleProps) {
  if (isTypingIndicator) {
    return (
      <div className="max-w-[75%] p-4 rounded-2xl bg-zinc-950 border border-white/5 text-zinc-400 rounded-tl-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-[pulse_1.4s_ease-in-out_infinite]" />
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-[pulse_1.4s_ease-in-out_0.2s_infinite]" />
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-[pulse_1.4s_ease-in-out_0.4s_infinite]" />
          <span className="text-xs text-zinc-600 italic select-none ml-1">
            {lang === "id" ? "Berpikir..." : "Thinking..."}
          </span>
        </div>
        {onStopStreaming && (
          <button
            onClick={onStopStreaming}
            className="text-[10px] text-zinc-600 hover:text-zinc-300 flex items-center gap-1 border border-white/5 px-2 py-0.5 rounded hover:bg-zinc-900 transition-colors"
            title={lang === "id" ? "Hentikan" : "Stop"}
          >
            <StopCircle className="w-3 h-3 text-red-500/60" />
            {lang === "id" ? "Hentikan" : "Stop"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`max-w-[75%] p-4 rounded-2xl text-sm leading-relaxed transition-all duration-300 ${
        message.role === "user"
          ? "ml-auto bg-zinc-100 text-black rounded-tr-sm select-text"
          : "bg-zinc-950 border border-white/5 text-zinc-300 rounded-tl-sm select-text"
      }`}
    >
      <div>{renderContent ? renderContent(message.content) : message.content}</div>

      {message.role === "assistant" && message.id && (
        <div className="mt-3 pt-3 border-t border-white/5 flex flex-col gap-2 transition-all">
          {submittedMessageIds.includes(message.id) ? (
            <span className="text-[10px] text-zinc-600 italic select-none">
              {lang === "id" ? "terima kasih atas masukannya." : "thank you for your reflection."}
            </span>
          ) : activeFeedbackMessageId === message.id ? (
            <div className="space-y-3">
              <span className="text-[10px] text-zinc-500 block font-medium">
                {lang === "id" ? "Detail tambahan (opsional):" : "Add optional details:"}
              </span>

              <div className="flex flex-wrap gap-1.5">
                {feedbackType === "grounding" || feedbackType === "comforting" ? (
                  <button
                    onClick={() => onFeedbackTagChange("comforting")}
                    className={`px-2 py-0.5 rounded-full text-[10px] border transition-all ${
                      feedbackTag === "comforting"
                        ? "bg-white text-black border-white"
                        : "bg-zinc-900 text-zinc-500 border-white/5 hover:border-white/10"
                    }`}
                  >
                    {lang === "id" ? "Nyamannya pas" : "Comforting"}
                  </button>
                ) : (
                  <>
                    {["too_generic", "too_much", "awkward", "repetitive"].map((tag) => (
                      <button
                        key={tag}
                        onClick={() => onFeedbackTagChange(tag)}
                        className={`px-2 py-0.5 rounded-full text-[10px] border transition-all ${
                          feedbackTag === tag
                            ? "bg-white text-black border-white"
                            : "bg-zinc-900 text-zinc-500 border-white/5 hover:border-white/10"
                        }`}
                      >
                        {tag === "too_generic" && (lang === "id" ? "Terlalu umum" : "Too generic")}
                        {tag === "too_much" && (lang === "id" ? "Berlebihan" : "Too much")}
                        {tag === "awkward" && (lang === "id" ? "Canggung" : "Awkward")}
                        {tag === "repetitive" && (lang === "id" ? "Berulang" : "Repetitive")}
                      </button>
                    ))}
                  </>
                )}
              </div>

              <textarea
                value={optionalText}
                onChange={(e) => onOptionalTextChange(e.target.value)}
                placeholder={lang === "id" ? "Ada hal lain yang terlewat?" : "Anything else we missed?"}
                className="w-full bg-zinc-900 border border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-zinc-300 placeholder-zinc-700 outline-none focus:border-white/10 transition-all resize-none h-14"
              />

              <div className="flex gap-2 justify-end">
                <button
                  onClick={onFeedbackCancel}
                  className="px-2 py-1 text-[10px] text-zinc-600 hover:text-zinc-400"
                >
                  {lang === "id" ? "Batal" : "Cancel"}
                </button>
                <button
                  onClick={() => onFeedbackSubmit(message.id!)}
                  className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 hover:border-white/20 text-[10px] text-zinc-300 hover:text-white transition-all"
                >
                  {lang === "id" ? "Kirim" : "Submit"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-[10px] text-zinc-600 select-none">
              <span>{lang === "id" ? "apakah respon ini..." : "did this feel..."}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onPrimaryFeedbackClick(message.id!, "grounding")}
                  className="hover:text-zinc-300 transition-colors"
                >
                  {lang === "id" ? "menenangkan" : "grounding"}
                </button>
                <span className="text-zinc-800">•</span>
                <button
                  onClick={() => onPrimaryFeedbackClick(message.id!, "too_generic")}
                  className="hover:text-zinc-300 transition-colors"
                >
                  {lang === "id" ? "terlalu umum" : "too generic"}
                </button>
                <span className="text-zinc-800">•</span>
                <button
                  onClick={() => onPrimaryFeedbackClick(message.id!, "awkward")}
                  className="hover:text-zinc-300 transition-colors"
                >
                  {lang === "id" ? "kurang pas" : "awkward"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
