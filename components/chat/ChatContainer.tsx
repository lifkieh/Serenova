"use client";

import { useState } from "react";

import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi, I'm Serenova. How are you feeling today?",
    },
  ]);

  const [loading, setLoading] = useState(false);

  const handleSend = async (message: string) => {
    const userMessage: Message = {
      role: "user",
      content: message,
    };

    setMessages((prev) => [...prev, userMessage]);

    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          message,
        }),
      });

      const data = await response.json();

      const aiMessage: Message = {
        role: "assistant",
        content: data.response,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl h-[80vh] bg-zinc-950 border border-zinc-800 rounded-3xl flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message, index) => (
          <ChatMessage
            key={index}
            role={message.role}
            content={message.content}
          />
        ))}

        {loading && (
          <ChatMessage
            role="assistant"
            content="Thinking..."
          />
        )}
      </div>

      <div className="border-t border-zinc-800 p-4">
        <ChatInput onSend={handleSend} />
      </div>
    </div>
  );
}