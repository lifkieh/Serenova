"use client";

import {
    useEffect,
    useRef,
    useState,
} from "react";

type Lang = "en" | "id";

const UI = {
    en: {
        session: (role: string) =>
            role === "guest" ? "Guest Session" : "Private Session",
        typing: "Serenova is typing...",
        placeholder: "Talk to Serenova...",
        send: "Send",
        logout: "Logout",
        langLabel: "ID",
        opening: "Hey. What's been sitting in your mind lately?",
        error: "Something felt interrupted just now.",
        fallback: "I'm here with you.",
    },
    id: {
        session: (role: string) =>
            role === "guest" ? "Sesi Tamu" : "Sesi Pribadi",
        typing: "Serenova lagi ngetik...",
        placeholder: "Cerita ke Serenova...",
        send: "Kirim",
        logout: "Keluar",
        langLabel: "EN",
        opening: "hei. lagi ada apa nih?",
        error: "Kayaknya ada yang ganggu koneksi kita barusan.",
        fallback: "aku dengerin kok.",
    },
};

export default function Dashboard() {
    const [role, setRole] = useState("");
    const [message, setMessage] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [lang, setLang] = useState<Lang>("en");

    const bottomRef = useRef<HTMLDivElement>(null);

    const [messages, setMessages] = useState<
        { role: string; content: string }[]
    >([
        {
            role: "assistant",
            content: UI.en.opening,
        },
    ]);

    useEffect(() => {
        fetch("/api/me")
            .then((res) => res.json())
            .then((data) => setRole(data.role));
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    function toggleLang() {
        const next: Lang = lang === "en" ? "id" : "en";
        setLang(next);
        // Reset conversation dengan opening sesuai bahasa baru
        setMessages([
            {
                role: "assistant",
                content: UI[next].opening,
            },
        ]);
        setMessage("");
    }

    async function sendMessage() {
        if (!message.trim() || isTyping) return;

        const currentMessage = message;
        const userMessage = { role: "user", content: currentMessage };

        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setMessage("");
        setIsTyping(true);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: updatedMessages,
                    lang,
                }),
            });

            const data = await res.json();

            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: data.response || UI[lang].fallback,
                },
            ]);
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: UI[lang].error,
                },
            ]);
        } finally {
            setIsTyping(false);
        }
    }

    async function logout() {
        await fetch("/api/logout", { method: "POST" });
        window.location.href = "/login";
    }

    const t = UI[lang];

    return (
        <main className="min-h-screen bg-black text-white flex flex-col">
            <div className="border-b border-white/10 p-4 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Serenova</h1>
                    <p className="text-sm text-zinc-400">{t.session(role)}</p>
                </div>

                <div className="flex items-center gap-2">
                    {/* Language toggle */}
                    <button
                        onClick={toggleLang}
                        className="border border-white/30 px-3 py-1.5 rounded-xl text-sm text-zinc-300 hover:border-white hover:text-white transition-colors"
                        title={lang === "en" ? "Switch to Bahasa Indonesia" : "Switch to English"}
                    >
                        {t.langLabel}
                    </button>

                    <button
                        onClick={logout}
                        className="border border-white px-4 py-2 rounded-xl"
                    >
                        {t.logout}
                    </button>
                </div>
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

                {isTyping && (
                    <div className="max-w-[80%] p-4 rounded-2xl bg-zinc-900 border border-white/10 text-zinc-400 animate-pulse">
                        {t.typing}
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            <div className="p-4 border-t border-white/10 flex gap-2">
                <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && window.innerWidth > 768) {
                            sendMessage();
                        }
                    }}
                    placeholder={t.placeholder}
                    disabled={isTyping}
                    className="flex-1 bg-zinc-900 border border-white/10 rounded-xl p-4 outline-none disabled:opacity-50"
                />

                <button
                    onClick={sendMessage}
                    disabled={isTyping}
                    className="bg-white text-black px-6 rounded-xl disabled:opacity-50"
                >
                    {t.send}
                </button>
            </div>
        </main>
    );
}