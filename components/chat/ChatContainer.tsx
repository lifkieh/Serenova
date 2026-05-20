"use client";

import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import MoodPicker from "@/components/ui/mood/MoodPicker";
import { Menu, AlertCircle, RotateCw, WifiOff } from "lucide-react";
import Sidebar, { Conversation } from "./Sidebar";
import InputBar from "./InputBar";
import MessageBubble from "./MessageBubble";
import ModeSwitcher from "@/components/mode/ModeSwitcher";

type Lang = "en" | "id";

const CHILL_UI = {
  en: {
    opening: "Yo bro! I'm your chill friend. Wanna talk, play some games, or have me generate some crazy image? Let's go!",
    placeholder: "Chill & talk with me...",
  },
  id: {
    opening: "Yo bro! Kenalin gua temen chill lu. Mau ngobrol seru, gabut, main tebak-tebakan, atau minta gua gambar sesuatu yang nyeleneh? Bebas cuy!",
    placeholder: "Nongkrong & ngobrol yuk...",
  }
};

const UI = {
  en: {
    session: (role: string) => (role === "guest" ? "Guest Session" : "Private Session"),
    typing: "Thinking...",
    placeholder: "Talk to Serenova...",
    send: "Send",
    logout: "Logout",
    opening: "Hey. What's been sitting in your mind lately?",
    error: "Something felt interrupted just now.",
    retry: "You can try sending that again.",
    fallback: "I'm here with you.",
    stop: "Stop",
    connectionError: "Connection feels silent right now.",
  },
  id: {
    session: (role: string) => (role === "guest" ? "Sesi Tamu" : "Sesi Pribadi"),
    typing: "Berpikir...",
    placeholder: "Cerita ke Serenova...",
    send: "Kirim",
    logout: "Keluar",
    opening: "hei. lagi ada apa nih?",
    error: "Kayaknya ada yang ganggu koneksi kita barusan.",
    retry: "Kamu bisa coba kirim lagi.",
    fallback: "aku dengerin kok.",
    stop: "Hentikan",
    connectionError: "Koneksi terasa sunyi saat ini.",
  },
};

function renderContentWithImages(content: string) {
  const imageRegex = /!\[([^\]]*)\]\((https?:\/\/[^\)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = imageRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={lastIndex}>{content.slice(lastIndex, match.index)}</span>);
    }
    parts.push(
      <div key={match.index} className="my-3">
        <img
          src={match[2]}
          alt={match[1]}
          className="rounded-xl max-w-full w-64 h-64 object-cover opacity-0 transition-opacity duration-500"
          loading="lazy"
          onLoad={(e) => {
            (e.target as HTMLImageElement).classList.replace("opacity-0", "opacity-100");
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        {match[1] && <p className="text-xs text-zinc-500 mt-1">{match[1]}</p>}
      </div>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(<span key={lastIndex}>{content.slice(lastIndex)}</span>);
  }

  return <div>{parts}</div>;
}

export default function ChatContainer({ mode = "journal" }: { mode?: "journal" | "chill" }) {
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [lang, setLang] = useState<Lang>("en");
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const [currentMood, setCurrentMood] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [saveHistory, setSaveHistory] = useState<boolean>(true);

  useEffect(() => {
    const saved = localStorage.getItem("serenova_save_history");
    if (saved !== null) {
      setSaveHistory(saved === "true");
    } else {
      localStorage.setItem("serenova_save_history", "true");
    }
  }, []);

  // Failure UX & Stream State
  const [isOffline, setIsOffline] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [lastFailedMessage, setLastFailedMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const isSendingRef = useRef(false);
  const activeRequestIdRef = useRef<string | null>(null);
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const isUserCancelledRef = useRef(false);
  const streamStateRef = useRef<"active" | "aborted" | "completed" | "errored">("active");

  // Sidebar
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const getOpeningText = (m: string, l: Lang) => (m === "chill" ? CHILL_UI[l].opening : UI[l].opening);

  const [messages, setMessages] = useState<{ id?: string; role: string; content: string }[]>([
    { role: "assistant", content: getOpeningText(mode, lang) },
  ]);

  // Feedback State
  const [activeFeedbackMessageId, setActiveFeedbackMessageId] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<string>("");
  const [feedbackTag, setFeedbackTag] = useState<string>("");
  const [optionalText, setOptionalText] = useState("");
  const [submittedMessageIds, setSubmittedMessageIds] = useState<string[]>([]);

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].role === "assistant") {
        return [{ role: "assistant", content: getOpeningText(mode, lang) }];
      }
      return prev;
    });
  }, [mode, lang]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOffline(!window.navigator.onLine);
      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => setRole(data.role))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (role === "guest") {
      const saved = localStorage.getItem("guest_messages");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.length > 0) {
            setMessages(parsed);
          }
        } catch (e) {
          console.error("Failed to parse guest messages:", e);
        }
      }
    }
  }, [role]);

  useEffect(() => {
    if (role === "guest" && messages.length > 0) {
      localStorage.setItem("guest_messages", JSON.stringify(messages));
    }
  }, [messages, role]);

  useEffect(() => {
    fetch("/api/mood")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data && data.data.length > 0) {
          setCurrentMood(data.data[0].mood);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadConversations();
    if (typeof window !== "undefined" && localStorage.getItem("serenova_save_history") === "true") {
      loadRecentConversation();
    }
  }, [mode]);

  useEffect(() => {
    return () => {
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort("navigation_abort");
      }
    };
  }, []);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  async function loadConversations() {
    try {
      const res = await fetch(`/api/conversations?mode=${mode}`);
      const data = await res.json();
      if (data.conversations) {
        // filter by mode later if backend supports it, for now show all or filter locally
        setConversations(data.conversations);
      }
    } catch {}
  }

  function setMessagesWithGreeting(msgs: any[], activeLang: Lang) {
    const activeOpening = getOpeningText(mode, activeLang);
    if (!msgs || msgs.length === 0) {
      setMessages([{ role: "assistant", content: activeOpening }]);
      return;
    }

    const firstMsg = msgs[0];
    const isFirstGreeting =
      firstMsg.role === "assistant" &&
      (firstMsg.content === UI.en.opening ||
        firstMsg.content === UI.id.opening ||
        firstMsg.content === CHILL_UI.en.opening ||
        firstMsg.content === CHILL_UI.id.opening);

    if (!isFirstGreeting) {
      setMessages([{ role: "assistant", content: activeOpening }, ...msgs]);
    } else {
      const normalizedMsgs = [...msgs];
      normalizedMsgs[0] = { ...normalizedMsgs[0], content: activeOpening };
      setMessages(normalizedMsgs);
    }
  }

  async function loadRecentConversation() {
    try {
      const res = await fetch(`/api/conversations?recent=true&mode=${mode}`);
      const data = await res.json();
      if (data.messages && data.messages.length > 0) {
        setMessagesWithGreeting(data.messages, lang);
      }
      if (data.conversationId) {
        setConversationId(data.conversationId);
      }
    } catch {}
  }

  async function selectConversation(id: string) {
    if (isTyping) stopStreaming();
    setConversationId(id);
    setIsSidebarOpen(false);
    setHasError(false);
    try {
      const res = await fetch(`/api/conversations?id=${id}`);
      const data = await res.json();
      if (data.messages && data.messages.length > 0) {
        setMessagesWithGreeting(data.messages, lang);
      } else {
        setMessages([{ role: "assistant", content: getOpeningText(mode, lang) }]);
      }
    } catch {
      setMessages([{ role: "assistant", content: getOpeningText(mode, lang) }]);
    }
  }

  function startNewConversation() {
    if (isTyping) stopStreaming();
    setConversationId(null);
    setHasError(false);
    // Do not alter saveHistory preference here
    const activeOpening = getOpeningText(mode, lang);
    const initialMsgs = [{ role: "assistant", content: activeOpening }];
    setMessages(initialMsgs);
    if (role === "guest") {
      localStorage.setItem("guest_messages", JSON.stringify(initialMsgs));
    }
    setIsSidebarOpen(false);
  }

  async function renameConversation(id: string, newTitle: string) {
    if (!newTitle.trim()) return;
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        setEditingId(null);
        loadConversations();
      }
    } catch {}
  }

  async function toggleArchiveConversation(id: string, currentlyArchived: boolean) {
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !currentlyArchived }),
      });
      if (res.ok) {
        loadConversations();
      }
    } catch {}
  }

  async function softDeleteConversation(id: string) {
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (res.ok) {
        if (conversationId === id) startNewConversation();
        loadConversations();
      }
    } catch {}
  }

  function stopStreaming() {
    if (activeAbortControllerRef.current) {
      isUserCancelledRef.current = true;
      streamStateRef.current = "aborted";
      activeAbortControllerRef.current.abort("manual_abort");
      setIsTyping(false);
      setIsSending(false);
      isSendingRef.current = false;
    }
  }

  function toggleLang(next: Lang) {
    if (next === lang) return;
    setLang(next);
    setMessages((prev) => {
      const activeOpening = getOpeningText(mode, next);
      if (prev.length === 0) return [{ role: "assistant", content: activeOpening }];
      const newMsgs = [...prev];
      if (
        newMsgs[0]?.role === "assistant" &&
        (newMsgs[0].content === UI.en.opening ||
          newMsgs[0].content === UI.id.opening ||
          newMsgs[0].content === CHILL_UI.en.opening ||
          newMsgs[0].content === CHILL_UI.id.opening)
      ) {
        newMsgs[0] = { ...newMsgs[0], content: activeOpening };
      }
      return newMsgs;
    });
    setMessage("");
    setHasError(false);
  }

  async function submitFeedback(msgId: string) {
    if (!conversationId) return;
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedbackType: feedbackTag || feedbackType,
          optionalText: optionalText,
          conversationId,
          messageId: msgId,
        }),
      });
      if (res.ok) {
        setSubmittedMessageIds((prev) => [...prev, msgId]);
        setActiveFeedbackMessageId(null);
      }
    } catch (error) {}
  }

  async function sendMessage(textToSend?: string) {
    const rawMessage = textToSend || message;
    if (isSendingRef.current) return;
    if (!rawMessage.trim() || isOffline) return;

    isSendingRef.current = true;
    setIsSending(true);
    setHasError(false);
    setLastFailedMessage(rawMessage);
    setIsTyping(true);
    isUserCancelledRef.current = false;
    streamStateRef.current = "active";

    let cleanedMessages = [...messages];
    if (
      cleanedMessages.length > 0 &&
      cleanedMessages[cleanedMessages.length - 1].role === "assistant" &&
      !cleanedMessages[cleanedMessages.length - 1].content.trim()
    ) {
      cleanedMessages.pop();
    }

    const lastMsg = cleanedMessages[cleanedMessages.length - 1];
    const isRetry = lastMsg && lastMsg.role === "user" && lastMsg.content === rawMessage;
    const updatedMessages = isRetry ? cleanedMessages : [...cleanedMessages, { role: "user", content: rawMessage }];

    setMessages([...updatedMessages, { role: "assistant", content: "" }]);
    setMessage("");

    const requestId = `req_${Math.random().toString(36).substring(2, 11)}`;
    activeRequestIdRef.current = requestId;

    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort("navigation_abort");
    }

    const controller = new AbortController();
    activeAbortControllerRef.current = controller;

    const timeoutId = setTimeout(() => {
      controller.abort("connection_timeout");
    }, 65000);

    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          lang,
          conversationId,
          mode,
          saveHistory,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (activeRequestIdRef.current !== requestId) return;
      if (!res.body) throw new Error("No response body");

      reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let fullResponse = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;

        if (activeRequestIdRef.current !== requestId) break;

        const chunkValue = decoder.decode(value, { stream: true });
        const lines = chunkValue.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              done = true;
              break;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.conversationId) {
                if (!conversationId) {
                  setConversationId(parsed.conversationId);
                  loadConversations();
                }
              }
              if (activeRequestIdRef.current !== requestId) break;

              if (parsed.messageId) {
                setMessages((prev) => {
                  if (activeRequestIdRef.current !== requestId) return prev;
                  const newMsgs = [...prev];
                  const last = newMsgs[newMsgs.length - 1];
                  if (last && last.role === "assistant") last.id = parsed.messageId;
                  return newMsgs;
                });
              }
              if (parsed.indicator) {
                setMessages((prev) => {
                  if (activeRequestIdRef.current !== requestId) return prev;
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1].content = parsed.indicator;
                  return newMsgs;
                });
              } else if (parsed.content) {
                fullResponse += parsed.content;
                setMessages((prev) => {
                  if (activeRequestIdRef.current !== requestId) return prev;
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1].content = fullResponse;
                  return newMsgs;
                });
              }
            } catch (e: any) {
              if (e.message && (e.message.includes("TIMEOUT") || e.message.includes("ABORT"))) {
                throw e;
              }
            }
          }
        }
      }
      if (activeRequestIdRef.current === requestId) streamStateRef.current = "completed";
    } catch (err: any) {
      if (activeRequestIdRef.current !== requestId) return;
      const isUserCancelled = isUserCancelledRef.current || err.message === "USER_CANCELLED";
      const isNavAbort = err.name === "AbortError";
      
      streamStateRef.current = isUserCancelled || isNavAbort ? "aborted" : "errored";

      if (!isUserCancelled && !isNavAbort) {
        setHasError(true);
      }

      setMessages((prev) => {
        const newMsgs = [...prev];
        if (newMsgs[newMsgs.length - 1]?.content === "") return prev.slice(0, -1);
        return newMsgs;
      });
    } finally {
      if (reader) {
        reader.releaseLock();
        try { await reader.cancel(); } catch {}
      }
      clearTimeout(timeoutId);
      if (activeRequestIdRef.current === requestId) {
        setIsTyping(false);
        setIsSending(false);
        isSendingRef.current = false;
        activeAbortControllerRef.current = null;
      }
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const t = UI[lang];

  return (
    <main className="h-[100dvh] bg-black text-zinc-300 flex overflow-hidden font-sans select-none md:select-text">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        conversations={conversations}
        activeConversationId={conversationId}
        onSelect={selectConversation}
        onNew={startNewConversation}
        lang={lang}
        onRename={renameConversation}
        onArchiveToggle={toggleArchiveConversation}
        onDelete={softDeleteConversation}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        editingId={editingId}
        editTitle={editTitle}
        onEditStart={(id, title) => { setEditingId(id); setEditTitle(title); }}
        onEditChange={setEditTitle}
        onEditCancel={() => setEditingId(null)}
        mode={mode}
      />

      <div className="flex-1 flex flex-col h-full bg-black overflow-hidden relative">
        <div className="border-b border-white/10 p-4 flex justify-between items-center bg-black/40 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-900 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-medium text-zinc-100 tracking-wide">Serenova</h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{t.session(role)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3 flex-wrap md:flex-nowrap justify-end shrink-0">
            
            <ModeSwitcher currentMode={mode} />

            {/* Save History Toggle */}
            <div className="relative flex items-center bg-zinc-900 border border-white/10 rounded-full p-[2px] shrink-0 select-none">
              <div
                className="absolute top-[2px] h-[calc(100%-4px)] rounded-full transition-all duration-300 ease-out"
                style={{
                  width: saveHistory ? (lang === "id" ? "92px" : "80px") : (lang === "id" ? "124px" : "106px"),
                  transform: saveHistory 
                    ? "translateX(0)" 
                    : `translateX(${saveHistory ? 0 : (lang === "id" ? "92px" : "80px")})`,
                  backgroundColor: saveHistory ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.08)",
                  border: saveHistory ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(255, 255, 255, 0.15)",
                }}
              />
              <button
                onClick={() => { setSaveHistory(true); localStorage.setItem("serenova_save_history", "true"); }}
                className={`relative z-10 py-1 px-2.5 rounded-full text-[10px] font-medium transition-colors duration-200 flex items-center justify-center gap-1.5 shrink-0 ${
                  saveHistory ? "text-emerald-400 font-semibold" : "text-zinc-500 hover:text-zinc-300"
                }`}
                style={{ width: lang === "id" ? "92px" : "80px" }}
              >
                <span className={`w-1 h-1 rounded-full shrink-0 ${saveHistory ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
                <span>{lang === "id" ? "Simpan Chat" : "Save Chat"}</span>
              </button>
              <button
                onClick={() => { setSaveHistory(false); localStorage.setItem("serenova_save_history", "false"); }}
                className={`relative z-10 py-1 px-2.5 rounded-full text-[10px] font-medium transition-colors duration-200 flex items-center justify-center gap-1.5 shrink-0 ${
                  !saveHistory ? "text-zinc-200 font-semibold" : "text-zinc-500 hover:text-zinc-300"
                }`}
                style={{ width: lang === "id" ? "124px" : "106px" }}
              >
                <span className={`w-1 h-1 rounded-full shrink-0 ${!saveHistory ? "bg-zinc-400" : "bg-zinc-600"}`} />
                <span>{lang === "id" ? "Obrolan Sementara" : "Temporary Chat"}</span>
              </button>
            </div>

            <Link href="/chat/journal" className="hidden md:block text-xs font-medium text-zinc-400 hover:text-white transition-colors px-2 py-1">Journal</Link>
            <Link href="/analytics" className="hidden md:block text-xs font-medium text-zinc-400 hover:text-white transition-colors px-2 py-1">Rhythm</Link>
            <Link href="/reflections" className="hidden md:block text-xs font-medium text-zinc-400 hover:text-white transition-colors px-2 py-1">Reflect</Link>

            {/* Language Switcher */}
            <div className="relative flex items-center bg-zinc-900 border border-white/10 rounded-full p-[2px]">
              <div
                className="absolute top-[2px] h-[calc(100%-4px)] w-[36px] bg-zinc-800 rounded-full transition-transform duration-200"
                style={{ transform: lang === "id" ? "translateX(0)" : "translateX(36px)" }}
              />
              <button onClick={() => toggleLang("id")} className={`relative z-10 w-[36px] py-1 rounded-full text-[10px] font-medium transition-colors duration-200 ${lang === "id" ? "text-white" : "text-zinc-500"}`}>ID</button>
              <button onClick={() => toggleLang("en")} className={`relative z-10 w-[36px] py-1 rounded-full text-[10px] font-medium transition-colors duration-200 ${lang === "en" ? "text-white" : "text-zinc-500"}`}>EN</button>
            </div>

            <button onClick={logout} className="border border-white/10 hover:border-white/20 hover:bg-zinc-900 px-3 py-1.5 rounded-xl text-xs transition-all text-zinc-400 hover:text-white">
              {t.logout}
            </button>
          </div>
        </div>

        {isOffline && (
          <div className="bg-zinc-950 border-b border-white/5 py-2 px-4 flex items-center justify-center gap-2 text-zinc-500 text-xs shrink-0 transition-all">
            <WifiOff className="w-3.5 h-3.5 animate-pulse text-zinc-600" />
            <span>{t.connectionError}</span>
          </div>
        )}

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-8 space-y-6 scrollbar-thin scrollbar-thumb-zinc-900">
          {messages.map((msg, index) => (
            <MessageBubble
              key={index}
              message={msg as any}
              lang={lang}
              submittedMessageIds={submittedMessageIds}
              activeFeedbackMessageId={activeFeedbackMessageId}
              feedbackType={feedbackType}
              feedbackTag={feedbackTag}
              optionalText={optionalText}
              onPrimaryFeedbackClick={(id, type) => {
                setActiveFeedbackMessageId(id);
                setFeedbackType(type);
                setFeedbackTag(type);
                setOptionalText("");
              }}
              onFeedbackTagChange={setFeedbackTag}
              onOptionalTextChange={setOptionalText}
              onFeedbackCancel={() => setActiveFeedbackMessageId(null)}
              onFeedbackSubmit={submitFeedback}
              renderContent={renderContentWithImages}
            />
          ))}

          {isTyping && (
            <MessageBubble
              message={{ role: "assistant", content: "" }}
              lang={lang}
              submittedMessageIds={[]}
              activeFeedbackMessageId={null}
              feedbackType=""
              feedbackTag=""
              optionalText=""
              onPrimaryFeedbackClick={() => {}}
              onFeedbackTagChange={() => {}}
              onOptionalTextChange={() => {}}
              onFeedbackCancel={() => {}}
              onFeedbackSubmit={() => {}}
              isTypingIndicator={true}
              onStopStreaming={stopStreaming}
            />
          )}

          {hasError && (
            <div className="max-w-[75%] ml-auto p-4 rounded-2xl bg-zinc-950 border border-red-950/20 text-zinc-400 text-xs flex flex-col gap-3">
              <div className="flex items-center gap-2 text-zinc-400">
                <AlertCircle className="w-4 h-4 text-zinc-600" />
                <span>{t.error}</span>
              </div>
              <p className="text-zinc-600 italic">{t.retry}</p>
              <button
                onClick={() => sendMessage(lastFailedMessage)}
                className="self-start flex items-center gap-1.5 bg-zinc-900 border border-white/5 hover:border-white/10 hover:text-white px-3 py-1.5 rounded-xl transition-all"
              >
                <RotateCw className="w-3 h-3" />
                Kirim ulang
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {mode === "journal" && (
          <div className="px-6 py-2 bg-black/20 shrink-0 border-t border-white/5 transition-all duration-300">
            <div className="flex items-center justify-between">
              {currentMood ? (
                <button
                  onClick={() => setShowMoodPicker(!showMoodPicker)}
                  className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-900 border border-white/5 hover:border-white/10 text-[10px] text-zinc-400 hover:text-white transition-all select-none"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse" />
                  <span>
                    {lang === "id" ? "Suasana hati:" : "Current mood:"}{" "}
                    <strong className="text-zinc-300 font-medium capitalize">
                      {(() => {
                        const MOOD_TRANSLATIONS: Record<string, Record<string, string>> = {
                          en: {
                            calm: "calm", tired: "tired", overwhelmed: "overwhelmed",
                            anxious: "anxious", lonely: "lonely", hopeful: "hopeful",
                            numb: "numb", frustrated: "frustrated", grateful: "grateful"
                          },
                          id: {
                            calm: "tenang", tired: "lelah", overwhelmed: "kewalahan",
                            anxious: "cemas", lonely: "kesepian", hopeful: "optimis",
                            numb: "hampa", frustrated: "frustrasi", grateful: "bersyukur"
                          }
                        };
                        return MOOD_TRANSLATIONS[lang]?.[currentMood] || currentMood;
                      })()}
                    </strong>
                  </span>
                  <span className="text-[8px] text-zinc-600 ml-1">
                    ({showMoodPicker ? (lang === "id" ? "tutup" : "hide") : (lang === "id" ? "ubah" : "change")})
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => setShowMoodPicker(!showMoodPicker)}
                  className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1 select-none"
                >
                  {showMoodPicker ? (lang === "id" ? "Sembunyikan" : "Hide Mood Picker") : (lang === "id" ? "Pilih Suasana Hati" : "Select Current Mood")}
                </button>
              )}
            </div>

            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                showMoodPicker ? "max-h-[120px] opacity-100 mt-2" : "max-h-0 opacity-0"
              }`}
            >
              <MoodPicker
                lang={lang}
                onSelect={(mood) => {
                  setCurrentMood(mood);
                  setShowMoodPicker(false);
                }}
              />
            </div>
          </div>
        )}

        {!saveHistory && messages.length > 1 && role !== "guest" && (
          <div className="flex justify-center pb-4 shrink-0">
            <button
              onClick={async () => {
                setSaveHistory(true);
                localStorage.setItem("serenova_save_history", "true");
                
                try {
                  const res = await fetch("/api/conversations", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ messages, mode })
                  });
                  const data = await res.json();
                  if (data.conversationId) {
                    setConversationId(data.conversationId);
                    loadConversations();
                  }
                } catch (e) {
                  console.error("Failed to save chat history", e);
                }
              }}
              className="text-xs text-zinc-500 hover:text-zinc-300 bg-zinc-900/50 hover:bg-zinc-900 border border-white/5 hover:border-white/10 px-4 py-2 rounded-full transition-all flex items-center gap-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50"></span>
              {lang === "id" ? "Simpan obrolan ini" : "Save this chat"}
            </button>
          </div>
        )}

        <InputBar
          message={message}
          isSending={isSending}
          isOffline={isOffline}
          lang={lang}
          textareaRef={textareaRef}
          onChange={setMessage}
          onSend={() => sendMessage()}
          placeholder={mode === "chill" ? CHILL_UI[lang].placeholder : UI[lang].placeholder}
        />
      </div>
    </main>
  );
}
