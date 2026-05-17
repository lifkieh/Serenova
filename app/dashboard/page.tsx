"use client";

import {
    useEffect,
    useRef,
    useState,
} from "react";
import MoodPicker from "@/components/ui/mood/MoodPicker";

type Lang = "en" | "id";

const UI = {
    en: {
        session: (role: string) =>
            role === "guest" ? "Guest Session" : "Private Session",
        typing: "Thinking...",
        placeholder: "Talk to Serenova...",
        send: "Send",
        logout: "Logout",
        opening: "Hey. What's been sitting in your mind lately?",
        error: "Something felt interrupted just now.",
        fallback: "I'm here with you.",
    },
    id: {
        session: (role: string) =>
            role === "guest" ? "Sesi Tamu" : "Sesi Pribadi",
        typing: "Berpikir...",
        placeholder: "Cerita ke Serenova...",
        send: "Kirim",
        logout: "Keluar",
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
    const [showMoodPicker, setShowMoodPicker] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);

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

    function toggleLang(next: Lang) {
        if (next === lang) return;
        setLang(next);
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
        setMessages([...updatedMessages, { role: "assistant", content: "" }]);
        setMessage("");
        setIsTyping(true);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: updatedMessages,
                    lang,
                    conversationId,
                }),
            });

            if (!res.body) throw new Error("No response body");
            
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let done = false;
            let fullResponse = "";

            while (!done) {
                const { value, done: doneReading } = await reader.read();
                done = doneReading;
                
                const chunkValue = decoder.decode(value, { stream: true });
                const lines = chunkValue.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            done = true;
                            break;
                        }
                        
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.conversationId && !conversationId) {
                                setConversationId(parsed.conversationId);
                            } else if (parsed.content) {
                                fullResponse += parsed.content;
                                setMessages((prev) => {
                                    const newMsgs = [...prev];
                                    newMsgs[newMsgs.length - 1].content = fullResponse;
                                    return newMsgs;
                                });
                            }
                        } catch (e) {
                            // ignore partial JSON due to chunking edges
                        }
                    }
                }
            }
        } catch {
            setMessages((prev) => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1].content = UI[lang].error;
                return newMsgs;
            });
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

                <div className="flex items-center gap-3">
                    <a href="/journal" className="text-xs font-medium text-zinc-400 hover:text-white transition-colors">
                        Journal
                    </a>
                    <a href="/analytics" className="text-xs font-medium text-zinc-400 hover:text-white transition-colors">
                        Rhythm
                    </a>
                    <a href="/reflections" className="text-xs font-medium text-zinc-400 hover:text-white transition-colors">
                        Reflect
                    </a>
                    {/* Pill toggle */}
                    <div className="relative flex items-center bg-zinc-900 border border-white/10 rounded-full p-[3px]">
                        {/* sliding pill */}
                        <div
                            className="absolute top-[3px] h-[calc(100%-6px)] w-[44px] bg-white rounded-full transition-transform duration-200"
                            style={{
                                transform: lang === "id" ? "translateX(0)" : "translateX(44px)",
                            }}
                        />
                        <button
                            onClick={() => toggleLang("id")}
                            className={`relative z-10 w-[44px] py-1.5 rounded-full text-xs font-medium transition-colors duration-200 ${lang === "id" ? "text-black" : "text-zinc-500"
                                }`}
                        >
                            ID
                        </button>
                        <button
                            onClick={() => toggleLang("en")}
                            className={`relative z-10 w-[44px] py-1.5 rounded-full text-xs font-medium transition-colors duration-200 ${lang === "en" ? "text-black" : "text-zinc-500"
                                }`}
                        >
                            EN
                        </button>
                    </div>

                    <button
                        onClick={logout}
                        className="border border-white/20 hover:border-white px-4 py-2 rounded-xl text-sm transition-colors"
                    >
                        {t.logout}
                    </button>
                </div>
            </div>


            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <p className="text-xs text-zinc-600 text-center pb-2">
                    {lang === "id"
                        ? "Percakapan diproses oleh AI pihak ketiga. Hindari berbagi info pribadi."
                        : "Conversations are processed by a third-party AI. Avoid sharing personal info."}
                </p>

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

                {isTyping && messages[messages.length - 1]?.content === "" && (
                    <div className="max-w-[80%] p-4 rounded-2xl bg-zinc-900 border border-white/10 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-[pulse_1.4s_ease-in-out_infinite]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-[pulse_1.4s_ease-in-out_0.2s_infinite]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-[pulse_1.4s_ease-in-out_0.4s_infinite]" />
                    </div>
                )}

                <div ref={bottomRef} />
            </div>
            <p className="px-4 pt-3 text-xs text-zinc-600 text-center">
                {lang === "id"
                    ? "Percakapan diproses oleh AI pihak ketiga. Hindari berbagi info pribadi."
                    : "Conversations are processed by a third-party AI. Avoid sharing personal info."}
            </p>
            <div className="border-t border-white/10 pt-2 pb-0 px-4 mt-2">
                <button 
                    onClick={() => setShowMoodPicker(!showMoodPicker)} 
                    className="text-xs text-zinc-500 hover:text-white transition-colors flex items-center gap-1"
                >
                    {showMoodPicker ? "Hide Mood" : "Set Mood"}
                </button>
                {showMoodPicker && (
                    <div className="mt-2">
                        <MoodPicker />
                    </div>
                )}
            </div>
            <div className="p-4 flex gap-2">
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