"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import MoodPicker from "@/components/ui/mood/MoodPicker";
import { 
  MessageSquare, 
  Trash2, 
  Archive, 
  Check, 
  X, 
  Edit2, 
  Plus, 
  Menu, 
  History, 
  WifiOff, 
  AlertCircle, 
  StopCircle, 
  RotateCw,
  ArchiveRestore
} from "lucide-react";

type Lang = "en" | "id";

type Conversation = {
  id: string;
  title: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

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
    session: (role: string) =>
      role === "guest" ? "Guest Session" : "Private Session",
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
    noHistory: "Conversations begin quietly.",
    archivedConversations: "Archived conversations",
    activeConversations: "Quiet Moments",
    newChat: "New Conversation",
    rename: "Rename",
    delete: "Delete",
    archive: "Archive",
    unarchive: "Unarchive",
    emptySidebar: "No conversations recorded yet."
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
    retry: "Kamu bisa coba kirim lagi.",
    fallback: "aku dengerin kok.",
    stop: "Hentikan",
    connectionError: "Koneksi terasa sunyi saat ini.",
    noHistory: "Percakapan dimulai dengan tenang.",
    archivedConversations: "Percakapan yang diarsipkan",
    activeConversations: "Momen Hening",
    newChat: "Percakapan Baru",
    rename: "Ubah Nama",
    delete: "Hapus",
    archive: "Arsip",
    unarchive: "Pulihkan",
    emptySidebar: "Belum ada percakapan tersimpan."
  },
};

function renderContent(content: string) {
  const imageRegex = /!\[([^\]]*)\]\((https?:\/\/[^\)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = imageRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={lastIndex}>{content.slice(lastIndex, match.index)}</span>
      );
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
        {match[1] && (
          <p className="text-xs text-zinc-500 mt-1">{match[1]}</p>
        )}
      </div>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(
      <span key={lastIndex}>{content.slice(lastIndex)}</span>
    );
  }

  return <div>{parts}</div>;
}

export default function ChillDashboard() {
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [lang, setLang] = useState<Lang>("en");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const mode = "chill";
  const [saveHistory, setSaveHistory] = useState<boolean>(false);

  // Update initial greeting when mode/lang changes
  useEffect(() => {
    if (mode) {
      setMessages((prev) => {
        if (
          prev.length === 1 &&
          prev[0].role === "assistant" &&
          (prev[0].content === UI.en.opening ||
            prev[0].content === UI.id.opening ||
            prev[0].content === CHILL_UI.en.opening ||
            prev[0].content === CHILL_UI.id.opening)
        ) {
          return [
            {
              role: "assistant",
              content: CHILL_UI[lang].opening,
            },
          ];
        }
        return prev;
      });
    }
  }, [mode, lang]);

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

  // Conversation list & Sidebar
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [messages, setMessages] = useState<
    { id?: string; role: string; content: string }[]
  >([
    {
      role: "assistant",
      content: UI.en.opening,
    },
  ]);

  // Beta Feedback System States
  const [activeFeedbackMessageId, setActiveFeedbackMessageId] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<string>("");
  const [feedbackTag, setFeedbackTag] = useState<string>("");
  const [optionalText, setOptionalText] = useState("");
  const [submittedMessageIds, setSubmittedMessageIds] = useState<string[]>([]);

  // Network State Listener
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

  // Fetch session
  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => setRole(data.role))
      .catch(() => {});
  }, []);

  // Load guest messages on mount if role is guest
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

  // Save guest messages to localStorage whenever they change
  useEffect(() => {
    if (role === "guest" && messages.length > 0) {
      localStorage.setItem("guest_messages", JSON.stringify(messages));
    }
  }, [messages, role]);



  // Load conversation list and load the most recent active one on mount
  useEffect(() => {
    loadConversations();
    loadRecentConversation();
  }, []);

  useEffect(() => {
    return () => {
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort("navigation_abort");
        console.log(`[CHAT] STREAM_ABORTED - requestId: ${activeRequestIdRef.current} (unmounted)`);
      }
    };
  }, []);

  // Auto-scroll when messages, typing state, or layout changes
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  function scrollToBottom() {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }

  // Adjust textarea height dynamically to prevent layout jump and keyboard clipping
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  async function loadConversations() {
    try {
      const res = await fetch("/api/conversations");
      const data = await res.json();
      if (data.conversations) {
        setConversations(data.conversations);
      }
    } catch {
      // Silently fail
    }
  }

  function setMessagesWithGreeting(msgs: Array<{ id?: string; role: string; content: string }>, activeLang: Lang) {
    const activeOpening = CHILL_UI[activeLang].opening;
    if (!msgs || msgs.length === 0) {
      setMessages([
        {
          role: "assistant",
          content: activeOpening,
        },
      ]);
      return;
    }

    const firstMsg = msgs[0];
    const enGreeting = UI.en.opening;
    const idGreeting = UI.id.opening;
    const enChillGreeting = CHILL_UI.en.opening;
    const idChillGreeting = CHILL_UI.id.opening;

    const isFirstGreeting =
      firstMsg.role === "assistant" &&
      (firstMsg.content === enGreeting ||
        firstMsg.content === idGreeting ||
        firstMsg.content === enChillGreeting ||
        firstMsg.content === idChillGreeting);

    if (!isFirstGreeting) {
      setMessages([
        {
          role: "assistant",
          content: activeOpening,
        },
        ...msgs,
      ]);
    } else {
      const normalizedMsgs = [...msgs];
      normalizedMsgs[0] = {
        ...normalizedMsgs[0],
        content: activeOpening,
      };
      setMessages(normalizedMsgs);
    }
  }

  async function loadRecentConversation() {
    try {
      const res = await fetch("/api/conversations?recent=true");
      const data = await res.json();
      if (data.messages && data.messages.length > 0) {
        setMessagesWithGreeting(data.messages, lang);
      }
      if (data.conversationId) {
        setConversationId(data.conversationId);
      }
    } catch {
      // Silently fail — opening message stays
    }
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
        setMessages([
          {
            role: "assistant",
            content: CHILL_UI[lang].opening,
          },
        ]);
      }
    } catch {
      setMessages([
        {
          role: "assistant",
          content: CHILL_UI[lang].opening,
        },
      ]);
    }
  }

  function startNewConversation() {
    if (isTyping) stopStreaming();
    setConversationId(null);
    setHasError(false);
    setSaveHistory(false);
    const activeOpening = CHILL_UI[lang].opening;
    const initialMsgs = [
      {
        role: "assistant",
        content: activeOpening,
      },
    ];
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
    } catch {
      // Silently fail
    }
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
    } catch {
      // Silently fail
    }
  }

  async function softDeleteConversation(id: string) {
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (conversationId === id) {
          startNewConversation();
        }
        loadConversations();
      }
    } catch {
      // Silently fail
    }
  }

  function stopStreaming() {
    if (activeAbortControllerRef.current) {
      isUserCancelledRef.current = true;
      streamStateRef.current = "aborted";
      activeAbortControllerRef.current.abort("manual_abort");
      console.log(`[CHAT] STREAM_ABORTED - requestId: ${activeRequestIdRef.current} (manually cancelled)`);
      setIsTyping(false);
      setIsSending(false);
      isSendingRef.current = false;
    }
  }

  function toggleLang(next: Lang) {
    if (next === lang) return;
    setLang(next);
    setMessages((prev) => {
      const activeOpening = CHILL_UI[next].opening;
      if (prev.length === 0) {
        return [{ role: "assistant", content: activeOpening }];
      }
      const newMsgs = [...prev];
      const enGreeting = UI.en.opening;
      const idGreeting = UI.id.opening;
      const enChillGreeting = CHILL_UI.en.opening;
      const idChillGreeting = CHILL_UI.id.opening;
      if (
        newMsgs[0]?.role === "assistant" &&
        (newMsgs[0].content === enGreeting ||
          newMsgs[0].content === idGreeting ||
          newMsgs[0].content === enChillGreeting ||
          newMsgs[0].content === idChillGreeting)
      ) {
        newMsgs[0] = { ...newMsgs[0], content: activeOpening };
      }
      return newMsgs;
    });
    setMessage("");
    setHasError(false);
  }

  // Beta Feedback System Handlers
  function handlePrimaryFeedbackClick(msgId: string, type: string) {
    setActiveFeedbackMessageId(msgId);
    setFeedbackType(type);
    setFeedbackTag(type);
    setOptionalText("");
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
    } catch (error) {
      console.error("Failed to submit feedback:", error);
    }
  }

  async function sendMessage(textToSend?: string) {
    const rawMessage = textToSend || message;
    if (isSendingRef.current) {
      console.warn(`[CHAT] SEND_BLOCKED_ALREADY_SENDING - message: ${rawMessage}`);
      return;
    }
    if (!rawMessage.trim() || isOffline) return;

    isSendingRef.current = true;
    setIsSending(true);
    setHasError(false);
    setLastFailedMessage(rawMessage);
    setIsTyping(true);
    isUserCancelledRef.current = false;
    streamStateRef.current = "active";

    // Dedup and normalize retry states cleanly
    let cleanedMessages = [...messages];
    
    // If the last message is an assistant bubble AND it is empty, pop it off (clean abort remnants)
    if (
      cleanedMessages.length > 0 && 
      cleanedMessages[cleanedMessages.length - 1].role === "assistant" &&
      !cleanedMessages[cleanedMessages.length - 1].content.trim()
    ) {
      cleanedMessages.pop();
    }

    const lastMsg = cleanedMessages[cleanedMessages.length - 1];
    const isRetry = lastMsg && lastMsg.role === "user" && lastMsg.content === rawMessage;

    const updatedMessages = isRetry 
      ? cleanedMessages 
      : [...cleanedMessages, { role: "user", content: rawMessage }];
    
    // Add user message immediately + placeholder for assistant response
    setMessages([...updatedMessages, { role: "assistant", content: "" }]);
    setMessage("");

    // Setup Timeout handling & AbortController
    const requestId = `req_${Math.random().toString(36).substring(2, 11)}`;
    activeRequestIdRef.current = requestId;
    console.log(`[CHAT] SEND_STARTED - requestId: ${requestId}`);

    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort("navigation_abort");
      console.log(`[CHAT] STREAM_ABORTED - requestId: ${activeAbortControllerRef.current} (cancelled by newer request)`);
    }

    const controller = new AbortController();
    activeAbortControllerRef.current = controller;
    
    // Relaxed frontend safeguard timeout (65 seconds) to let backend manage fallback rotation and cold starts dynamically
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

      if (activeRequestIdRef.current !== requestId) {
        console.log(`[CHAT] STALE_STREAM_IGNORED - requestId: ${requestId}`);
        return;
      }

      if (res.ok) {
        console.log(`[CHAT] STREAM_CONNECTED - requestId: ${requestId}`);
      }

      if (!res.body) throw new Error("No response body");

      reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let fullResponse = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;

        if (activeRequestIdRef.current !== requestId) {
          console.log(`[CHAT] STALE_STREAM_IGNORED - requestId: ${requestId}`);
          break;
        }

        const chunkValue = decoder.decode(value, { stream: true });
        const lines = chunkValue.split("\n");

        for (const line of lines) {
          // SSE keep-alive comments are automatically ignored as they don't start with "data: "
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              done = true;
              break;
            }

            try {
              const parsed = JSON.parse(data);
              
              // Backend propagates errors via JSON stream
              if (parsed.error) {
                throw new Error(parsed.error);
              }

              if (parsed.conversationId) {
                if (!conversationId) {
                  setConversationId(parsed.conversationId);
                  loadConversations();
                }
              }

              if (activeRequestIdRef.current !== requestId) {
                console.log(`[CHAT] STALE_STREAM_IGNORED - requestId: ${requestId}`);
                break;
              }

              if (parsed.messageId) {
                setMessages((prev) => {
                  if (activeRequestIdRef.current !== requestId) return prev;
                  const newMsgs = [...prev];
                  const last = newMsgs[newMsgs.length - 1];
                  if (last && last.role === "assistant") {
                     last.id = parsed.messageId;
                  }
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
            } catch (e) {
              // Ignore partial JSON parsing edges or delegate thrown errors
              if (e instanceof Error && e.message && (e.message.includes("TIMEOUT") || e.message.includes("ABORT"))) {
                throw e;
              }
            }
          }
        }
      }

      if (activeRequestIdRef.current === requestId) {
        streamStateRef.current = "completed";
      }
    } catch (err: any) {
      if (activeRequestIdRef.current !== requestId) {
        console.log(`[CHAT] STALE_STREAM_IGNORED - requestId: ${requestId}`);
        return;
      }

      const isUserCancelled = isUserCancelledRef.current || err.message === "USER_CANCELLED";
      let finalState: "aborted" | "errored" = "errored";
      let abortReason = "PROVIDER_ABORT";

      if (isUserCancelled) {
        finalState = "aborted";
        abortReason = "USER_CANCELLED";
        console.info(`[CHAT] STREAM_ABORTED - requestId: ${requestId} (USER_CANCELLED)`);
      } else if (err.message === "CONNECTION_TIMEOUT") {
        finalState = "aborted";
        abortReason = "CONNECTION_TIMEOUT";
        console.warn(`[CHAT] STREAM_ABORTED - requestId: ${requestId} (CONNECTION_TIMEOUT)`);
      } else if (err.message === "IDLE_TIMEOUT") {
        finalState = "aborted";
        abortReason = "IDLE_TIMEOUT";
        console.warn(`[CHAT] STREAM_ABORTED - requestId: ${requestId} (IDLE_TIMEOUT)`);
      } else if (err.name === "AbortError") {
        finalState = "aborted";
        abortReason = "NAVIGATION_ABORT";
        console.info(`[CHAT] STREAM_ABORTED - requestId: ${requestId} (NAVIGATION_ABORT)`);
      } else {
        console.error(`[CHAT] Stream failure - requestId: ${requestId}:`, err);
      }

      streamStateRef.current = finalState;

      // Only show error interruption UI for actual connection/idle/provider failures
      if (!isUserCancelled && abortReason !== "NAVIGATION_ABORT") {
        setHasError(true);
      }

      setMessages((prev) => {
        const newMsgs = [...prev];
        // Strip the trailing empty assistant message if it was completely empty
        if (newMsgs[newMsgs.length - 1]?.content === "") {
          return prev.slice(0, -1);
        }
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
        
        if (streamStateRef.current === "completed") {
          console.log(`[CHAT] STREAM_COMPLETED - requestId: ${requestId}`);
        }
      }
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const t = UI[lang];

  // Separate active vs archived conversations with search filter
  const filteredConversations = conversations.filter(c => 
    (c.title || "").toLowerCase().includes(searchQuery.toLowerCase())
  );
  const activeConversations = filteredConversations.filter(c => !c.isArchived);
  const archivedConversations = filteredConversations.filter(c => c.isArchived);



  return (
    <main className="h-[100dvh] bg-black text-zinc-300 flex overflow-hidden font-sans select-none md:select-text">
      
      {/* 1. SIDEBAR (Quiet History Archive) */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-zinc-950 border-r border-white/10 flex flex-col transform transition-transform duration-300 ease-out md:static md:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-zinc-500" />
            {t.activeConversations}
          </span>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden text-zinc-500 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* New Chat Button & Search Bar */}
        <div className="p-3 space-y-2">
          <button
            onClick={startNewConversation}
            className="w-full flex items-center justify-center gap-2 bg-zinc-900 border border-white/5 hover:border-white/15 text-xs text-zinc-400 hover:text-white py-2.5 px-4 rounded-xl transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            {t.newChat}
          </button>
          
          <input
            type="text"
            placeholder={lang === "id" ? "Cari percakapan..." : "Search conversations..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900/50 border border-white/5 focus:border-white/10 rounded-xl px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-700 outline-none transition-all"
          />
        </div>

        {/* Conversations Lists */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-6">
          {/* Active section */}
          <div className="space-y-1">
            {activeConversations.length === 0 && archivedConversations.length === 0 ? (
              <p className="text-xs text-zinc-700 text-center py-8 px-4 leading-relaxed">
                {t.emptySidebar}
              </p>
            ) : (
              activeConversations.map((c) => (
                <div
                  key={c.id}
                  className={`group relative flex items-center justify-between p-2.5 rounded-xl transition-colors ${
                    conversationId === c.id
                      ? "bg-zinc-900 text-white"
                      : "hover:bg-zinc-900/50 text-zinc-400"
                  }`}
                >
                  {editingId === c.id ? (
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") renameConversation(c.id, editTitle);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="bg-black border border-white/10 rounded px-1.5 py-0.5 text-xs text-white outline-none w-full mr-8"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => selectConversation(c.id)}
                      className="flex-1 text-left text-xs truncate pr-16"
                    >
                      {c.title || "New Conversation"}
                    </button>
                  )}

                  {/* Inline actions (Hover to reveal on desktop, subtle transparency on mobile) */}
                  <div className="absolute right-2 flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-950 md:bg-transparent pl-2 py-0.5">
                    {editingId === c.id ? (
                      <>
                        <button
                          onClick={() => renameConversation(c.id, editTitle)}
                          className="p-1 text-green-500 hover:text-green-400"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 text-red-500 hover:text-red-400"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditingId(c.id);
                            setEditTitle(c.title);
                          }}
                          className="p-1 text-zinc-500 hover:text-zinc-300"
                          title={t.rename}
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => toggleArchiveConversation(c.id, false)}
                          className="p-1 text-zinc-500 hover:text-zinc-300"
                          title={t.archive}
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => softDeleteConversation(c.id)}
                          className="p-1 text-zinc-500 hover:text-red-400"
                          title={t.delete}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Archived section */}
          {archivedConversations.length > 0 && (
            <div className="space-y-1 border-t border-white/5 pt-4">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 px-3 block mb-2">
                {t.archivedConversations}
              </span>
              {archivedConversations.map((c) => (
                <div
                  key={c.id}
                  className={`group relative flex items-center justify-between p-2 rounded-xl transition-colors opacity-60 ${
                    conversationId === c.id
                      ? "bg-zinc-900 text-white"
                      : "hover:bg-zinc-900/45 text-zinc-500"
                  }`}
                >
                  <button
                    onClick={() => selectConversation(c.id)}
                    className="flex-1 text-left text-xs truncate pr-12"
                  >
                    {c.title}
                  </button>

                  <div className="absolute right-2 flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-950 md:bg-transparent pl-2 py-0.5">
                    <button
                      onClick={() => toggleArchiveConversation(c.id, true)}
                      className="p-1 text-zinc-500 hover:text-zinc-300"
                      title={t.unarchive}
                    >
                      <ArchiveRestore className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => softDeleteConversation(c.id)}
                      className="p-1 text-zinc-500 hover:text-red-400"
                      title={t.delete}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/10 text-[10px] text-zinc-600 text-center">
          Serenova is a safe harbor.
        </div>
      </div>

      {/* Backdrop overlay for Mobile Sidebar */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
        />
      )}

      {/* 2. CHAT CONTAINER */}
      <div className="flex-1 flex flex-col h-full bg-black overflow-hidden relative">
        
        {/* Navigation Bar */}
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
            {/* Journal Switcher Link */}
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 border border-white/10 text-[10px] text-zinc-400 hover:text-white hover:border-white/20 transition-all font-medium shrink-0"
            >
              <MessageSquare className="w-3 h-3" />
              Journal Mode
            </Link>

            {/* Save History Toggle (Premium Segmented Control) */}
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
                onClick={() => {
                  setSaveHistory(true);
                  localStorage.setItem("serenova_save_history", "true");
                }}
                className={`relative z-10 py-1 px-2.5 rounded-full text-[10px] font-medium transition-colors duration-200 flex items-center justify-center gap-1.5 shrink-0 ${
                  saveHistory 
                    ? "text-emerald-400 font-semibold" 
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
                style={{
                  width: lang === "id" ? "92px" : "80px",
                }}
              >
                <span className={`w-1 h-1 rounded-full shrink-0 ${saveHistory ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
                <span>{lang === "id" ? "Simpan Chat" : "Save Chat"}</span>
              </button>
              <button
                onClick={() => {
                  setSaveHistory(false);
                  localStorage.setItem("serenova_save_history", "false");
                }}
                className={`relative z-10 py-1 px-2.5 rounded-full text-[10px] font-medium transition-colors duration-200 flex items-center justify-center gap-1.5 shrink-0 ${
                  !saveHistory 
                    ? "text-zinc-200 font-semibold" 
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
                style={{
                  width: lang === "id" ? "124px" : "106px",
                }}
              >
                <span className={`w-1 h-1 rounded-full shrink-0 ${!saveHistory ? "bg-zinc-400" : "bg-zinc-600"}`} />
                <span>{lang === "id" ? "Obrolan Sementara" : "Temporary Chat"}</span>
              </button>
            </div>

            <Link
              href="/journal"
              className="hidden md:block text-xs font-medium text-zinc-400 hover:text-white transition-colors px-2 py-1"
            >
              Journal
            </Link>
            <Link
              href="/analytics"
              className="hidden md:block text-xs font-medium text-zinc-400 hover:text-white transition-colors px-2 py-1"
            >
              Rhythm
            </Link>
            <Link
              href="/reflections"
              className="hidden md:block text-xs font-medium text-zinc-400 hover:text-white transition-colors px-2 py-1"
            >
              Reflect
            </Link>

            {/* Language Switcher */}
            <div className="relative flex items-center bg-zinc-900 border border-white/10 rounded-full p-[2px]">
              <div
                className="absolute top-[2px] h-[calc(100%-4px)] w-[36px] bg-zinc-800 rounded-full transition-transform duration-200"
                style={{
                  transform: lang === "id" ? "translateX(0)" : "translateX(36px)",
                }}
              />
              <button
                onClick={() => toggleLang("id")}
                className={`relative z-10 w-[36px] py-1 rounded-full text-[10px] font-medium transition-colors duration-200 ${
                  lang === "id" ? "text-white" : "text-zinc-500"
                }`}
              >
                ID
              </button>
              <button
                onClick={() => toggleLang("en")}
                className={`relative z-10 w-[36px] py-1 rounded-full text-[10px] font-medium transition-colors duration-200 ${
                  lang === "en" ? "text-white" : "text-zinc-500"
                }`}
              >
                EN
              </button>
            </div>

            <button
              onClick={logout}
              className="border border-white/10 hover:border-white/20 hover:bg-zinc-900 px-3 py-1.5 rounded-xl text-xs transition-all text-zinc-400 hover:text-white"
            >
              {t.logout}
            </button>
          </div>
        </div>

        {/* Offline Banner */}
        {isOffline && (
          <div className="bg-zinc-950 border-b border-white/5 py-2 px-4 flex items-center justify-center gap-2 text-zinc-500 text-xs shrink-0 transition-all">
            <WifiOff className="w-3.5 h-3.5 animate-pulse text-zinc-600" />
            <span>{t.connectionError}</span>
          </div>
        )}

        {/* Messages Stream viewport */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-6 py-8 space-y-6 scrollbar-thin scrollbar-thumb-zinc-900"
        >
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`max-w-[75%] p-4 rounded-2xl text-sm leading-relaxed transition-all duration-300 ${
                msg.role === "user"
                  ? "ml-auto bg-zinc-100 text-black rounded-tr-sm select-text"
                  : "bg-zinc-950 border border-white/5 text-zinc-300 rounded-tl-sm select-text"
              }`}
            >
              {renderContent(msg.content)}

              {/* 1. Subtle, platonically styled Beta Feedback System */}
              {msg.role === "assistant" && msg.id && (
                <div className="mt-3 pt-3 border-t border-white/5 flex flex-col gap-2 transition-all">
                  {submittedMessageIds.includes(msg.id) ? (
                    <span className="text-[10px] text-zinc-600 italic select-none">
                      {lang === "id" ? "terima kasih atas masukannya." : "thank you for your reflection."}
                    </span>
                  ) : activeFeedbackMessageId === msg.id ? (
                    <div className="space-y-3">
                      <span className="text-[10px] text-zinc-500 block font-medium">
                        {lang === "id" ? "Detail tambahan (opsional):" : "Add optional details:"}
                      </span>
                      
                      {/* Specific Tag Selection */}
                      <div className="flex flex-wrap gap-1.5">
                        {feedbackType === "grounding" || feedbackType === "comforting" ? (
                          <button
                            onClick={() => setFeedbackTag("comforting")}
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
                                onClick={() => setFeedbackTag(tag)}
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

                      {/* Free text input */}
                      <textarea
                        value={optionalText}
                        onChange={(e) => setOptionalText(e.target.value)}
                        placeholder={lang === "id" ? "Ada hal lain yang terlewat?" : "Anything else we missed?"}
                        className="w-full bg-zinc-900 border border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-zinc-300 placeholder-zinc-700 outline-none focus:border-white/10 transition-all resize-none h-14"
                      />

                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setActiveFeedbackMessageId(null)}
                          className="px-2 py-1 text-[10px] text-zinc-600 hover:text-zinc-400"
                        >
                          {lang === "id" ? "Batal" : "Cancel"}
                        </button>
                        <button
                          onClick={() => submitFeedback(msg.id!)}
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
                          onClick={() => handlePrimaryFeedbackClick(msg.id!, "grounding")}
                          className="hover:text-zinc-300 transition-colors"
                        >
                          {lang === "id" ? "menenangkan" : "grounding"}
                        </button>
                        <span className="text-zinc-800">•</span>
                        <button
                          onClick={() => handlePrimaryFeedbackClick(msg.id!, "too_generic")}
                          className="hover:text-zinc-300 transition-colors"
                        >
                          {lang === "id" ? "terlalu umum" : "too generic"}
                        </button>
                        <span className="text-zinc-800">•</span>
                        <button
                          onClick={() => handlePrimaryFeedbackClick(msg.id!, "awkward")}
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
          ))}

          {/* Typing Indicator / Stream Pace */}
          {isTyping && (
            <div className="max-w-[75%] p-4 rounded-2xl bg-zinc-950 border border-white/5 text-zinc-400 rounded-tl-sm flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-[pulse_1.4s_ease-in-out_infinite]" />
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-[pulse_1.4s_ease-in-out_0.2s_infinite]" />
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-[pulse_1.4s_ease-in-out_0.4s_infinite]" />
                <span className="text-xs text-zinc-600 italic select-none ml-1">{t.typing}</span>
              </div>
              <button
                onClick={stopStreaming}
                className="text-[10px] text-zinc-600 hover:text-zinc-300 flex items-center gap-1 border border-white/5 px-2 py-0.5 rounded hover:bg-zinc-900 transition-colors"
                title={t.stop}
              >
                <StopCircle className="w-3 h-3 text-red-500/60" />
                {t.stop}
              </button>
            </div>
          )}

          {/* Failure & Retry UX Banner */}
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



        {/* Input Bar Section */}
        <div className="p-4 bg-zinc-950/50 border-t border-white/10 flex flex-col gap-2 shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              rows={1}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 768) {
                  e.preventDefault();
                  if (!isSending) {
                    sendMessage();
                  }
                }
              }}
              placeholder={t.placeholder}
              disabled={isSending || isOffline}
              className="flex-1 bg-zinc-900 border border-white/10 rounded-xl p-3 outline-none disabled:opacity-50 text-sm text-zinc-100 placeholder-zinc-500 resize-none max-h-32 min-h-[44px] transition-all scrollbar-none"
            />

            <button
              onClick={() => sendMessage()}
              disabled={isSending || isOffline || !message.trim()}
              className="bg-zinc-100 hover:bg-white text-black text-xs font-semibold px-5 h-11 rounded-xl disabled:opacity-40 disabled:hover:bg-zinc-100 transition-all select-none flex items-center justify-center shrink-0"
            >
              {t.send}
            </button>
          </div>

          <p className="text-[9px] text-zinc-700 text-center select-none pt-1">
            {lang === "id"
              ? "Percakapan diproses secara privat. Hindari berbagi informasi sensitif."
              : "Conversations are kept safe and private. Avoid sharing highly sensitive keys."}
          </p>
        </div>
      </div>
    </main>
  );
}