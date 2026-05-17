"use client";

import { useEffect, useState } from "react";

export default function Dashboard() {
    const [role, setRole] = useState("");
    const [message, setMessage] = useState("");

    const [messages, setMessages] = useState<
        { role: string; content: string }[]
    >([
        {
            role: "assistant",
            content:
                "Hi, I’m Serenova. A calm space for you to think, vent, reflect, or simply breathe for a moment.\n\nI’m not a therapist, but I’ll listen and talk with you gently.\n\nHow are you feeling today?",
        },
    ]);

    useEffect(() => {
        fetch("/api/me")
            .then((res) => res.json())
            .then((data) => {
                setRole(data.role);
            });
    }, []);

    async function sendMessage() {
        if (!message) return;

        const userMessage = {
            role: "user",
            content: message,
        };

        setMessages((prev) => [
            ...prev,
            userMessage,
        ]);

        setMessage("");

        const res = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type":
                    "application/json",
            },
            body: JSON.stringify({
                message,
            }),
        });

        const data = await res.json();

        setMessages((prev) => [
            ...prev,
            {
                role: "assistant",
                content: data.response,
            },
        ]);
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
                        Logged in as {role}
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
                {messages.map((msg, index) => (
                    <div
                        key={index}
                        className={`max-w-[80%] p-4 rounded-2xl ${msg.role === "user"
                            ? "ml-auto bg-white text-black"
                            : "bg-zinc-900 border border-white/10"
                            }`}
                    >
                        {msg.content}
                    </div>
                ))}
            </div>

            <div className="p-4 border-t border-white/10 flex gap-2">
                <input
                    value={message}
                    onChange={(e) =>
                        setMessage(e.target.value)
                    }
                    placeholder="Talk to Serenova..."
                    className="flex-1 bg-zinc-900 border border-white/10 rounded-xl p-4 outline-none"
                />

                <button
                    onClick={sendMessage}
                    className="bg-white text-black px-6 rounded-xl"
                >
                    Send
                </button>
            </div>
        </main>
    );
}