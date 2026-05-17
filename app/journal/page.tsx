"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import MoodPicker from "@/components/ui/mood/MoodPicker";
import Link from "next/link";
import { useRouter } from "next/navigation";

const PROMPTS = [
  "What's been sitting in your mind today?",
  "What felt heavy this week? What felt light?",
  "Is there something you've been avoiding thinking about?",
  "What do you wish someone understood about how you're feeling?",
  "What would feel like relief right now?",
];

export default function JournalPage() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [entryId, setEntryId] = useState<string | null>(null);
  
  const contentRef = useRef(content);
  const titleRef = useRef(title);

  useEffect(() => {
    contentRef.current = content;
    titleRef.current = title;
  }, [content, title]);

  const saveJournal = useCallback(async () => {
    const currentContent = contentRef.current;
    const currentTitle = titleRef.current;
    
    if (!currentContent.trim() && !currentTitle.trim()) return;

    setSaveState("saving");
    try {
      if (entryId) {
        await fetch(`/api/journal/${entryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: currentTitle, content: currentContent }),
        });
      } else {
        const res = await fetch("/api/journal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: currentTitle, content: currentContent }),
        });
        const json = await res.json();
        if (json.data?.id) {
          setEntryId(json.data.id);
        }
      }
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch (error) {
      console.error("Save failed", error);
      setSaveState("idle");
    }
  }, [entryId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (content || title) {
        saveJournal();
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [content, title, saveJournal]);

  const handlePromptClick = (prompt: string) => {
    if (!title) {
      setTitle(prompt);
    } else {
      setContent((prev) => prev + (prev ? "\n\n" : "") + prompt + "\n");
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col p-6 max-w-4xl mx-auto font-sans">
      <header className="flex justify-between items-center mb-12">
        <Link href="/dashboard" className="text-zinc-500 hover:text-white transition-colors text-sm">
          ← Back
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/journal/list" className="text-zinc-500 hover:text-white transition-colors">
            Entries
          </Link>
          <span className="text-zinc-600">|</span>
          <span className={`transition-opacity duration-500 ${saveState === "idle" ? "opacity-0" : "opacity-100"} ${saveState === "saving" ? "text-zinc-400" : "text-zinc-300"}`}>
            {saveState === "saving" ? "Saving..." : "Saved"}
          </span>
        </div>
      </header>

      <div className="mb-8 overflow-x-auto whitespace-nowrap pb-2 scrollbar-hide">
        <div className="flex gap-2">
          {PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handlePromptClick(prompt)}
              className="px-4 py-2 rounded-full border border-white/10 text-xs text-zinc-400 hover:text-white hover:border-white/30 transition-colors bg-zinc-950"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="bg-transparent text-3xl font-medium outline-none placeholder:text-zinc-800 text-zinc-200"
        />
        
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Start writing..."
          className="flex-1 bg-transparent resize-none outline-none text-xl leading-relaxed text-zinc-300 placeholder:text-zinc-800"
        />
      </div>

      <div className="mt-8 pt-4 border-t border-white/5">
        <p className="text-xs text-zinc-600 mb-3 ml-2">How are you feeling right now?</p>
        <MoodPicker 
          onSelect={(mood) => {
            if (entryId) {
              fetch(`/api/journal/${entryId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mood_tag: mood }),
              });
            }
          }}
        />
      </div>
    </main>
  );
}
