"use client";

import {
    useEffect,
    useRef,
    useState,
} from "react";

export default function Dashboard() {
    const [role, setRole] = useState("");
    const [message, setMessage] = useState("");
    const [isTyping, setIsTyping] =
        useState(false);

    const bottomRef =
        useRef<HTMLDivElement>(null);

    const [messages, setMessages] =
        useState<
            {
                role: string;
                content: string;
            }[]
        >([
            {
                role: "assistant",
                content:
                    "Hello there. What's been sitting in your mind recently?",
            }
        ]);

    useEffect(() => {
        fetch("/api/me")
            .then((res) => res.json())
            .then((data) => {
                setRole(data.role);
            });
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({
            behavior: "smooth",
        });
    }, [messages, isTyping]);

    async function sendMessage() {
        if (!message.trim() || isTyping)
            return;

        const currentMessage = message;

        const userMessage = {
            role: "user",
            content: currentMessage,
        };

        setMessages((prev) => [
            ...prev,
            userMessage,
        ]);

        setMessage("");
        setIsTyping(true);

        try {
            const res = await fetch(
                "/api/chat",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        message:
                            currentMessage,
                    }),
                }
            );

            const data = await res.json();

            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content:
                        data.response ||
                        "I'm here with you.",
                },
            ]);
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content:
                        "Something felt interrupted just now.",
                },
            ]);
        } finally {
            setIsTyping(false);
        }
    }

    async function logout() {
        await fetch("/api/logout", {
            method: "POST",
        });

        window.location.href = "/login";
    }

    return (
        <main className="min-h-screen bg-black text-white flex flex-col">
            <div className="border-b border-white/10 p-4 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">
                        Serenova
                    </h1>

                    <p className="text-sm text-zinc-400">
                        {role === "guest"
                            ? "Guest Session"
                            : "Private Session"}
                    </p>
                </div>

                <button
                    onClick={logout}
                    className="border border-white px-4 py-2 rounded-xl"
                >
                    Logout
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map(
                    (msg, index) => (
                        <div
                            key={index}
                            className={`max-w-[80%] p-4 rounded-2xl ${msg.role ===
                                "user"
                                ? "ml-auto bg-white text-black"
                                : "bg-zinc-900 border border-white/10"
                                }`}
                        >
                            {msg.content}
                        </div>
                    )
                )}

                {isTyping && (
                    <div className="max-w-[80%] p-4 rounded-2xl bg-zinc-900 border border-white/10 text-zinc-400 animate-pulse">
                        Serenova is typing...
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            <div className="p-4 border-t border-white/10 flex gap-2">
                <input
                    value={message}
                    onChange={(e) =>
                        setMessage(
                            e.target.value
                        )
                    }
                    onKeyDown={(e) => {
                        if (
                            e.key ===
                            "Enter" &&
                            window.innerWidth >
                            768
                        ) {
                            sendMessage();
                        }
                    }}
                    placeholder="Talk to Serenova..."
                    disabled={isTyping}
                    className="flex-1 bg-zinc-900 border border-white/10 rounded-xl p-4 outline-none disabled:opacity-50"
                />

                <button
                    onClick={sendMessage}
                    disabled={isTyping}
                    className="bg-white text-black px-6 rounded-xl disabled:opacity-50"
                >
                    Send
                </button>
            </div>
        </main>
    );
}
