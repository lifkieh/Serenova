"use client";

import { useState } from "react";

type Props = {
  onSend: (message: string) => void;
};

export default function ChatInput({
  onSend,
}: Props) {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (!message.trim()) return;

    onSend(message);
    setMessage("");
  };

  return (
    <div className="flex gap-3">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Talk about your day..."
        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 resize-none outline-none focus:border-zinc-700"
      />

      <button
        onClick={handleSend}
        className="bg-zinc-100 text-zinc-900 px-5 rounded-2xl hover:bg-zinc-300 transition"
      >
        Send
      </button>
    </div>
  );
}