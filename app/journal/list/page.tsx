"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Calendar, ArrowLeft, Plus } from "lucide-react";

type Journal = {
  id: string;
  title: string | null;
  content: string;
  mood_tag: string | null;
  created_at: string;
};

export default function JournalListPage() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadJournals() {
      try {
        const res = await fetch("/api/journal");
        const json = await res.json();
        if (json.data) {
          setJournals(json.data);
        }
      } catch (error) {
        console.error("Failed to load journals", error);
      } finally {
        setLoading(false);
      }
    }
    loadJournals();
  }, []);

  return (
    <main className="min-h-screen bg-black text-zinc-300 p-6 max-w-2xl mx-auto font-sans flex flex-col justify-between">
      <div>
        {/* Header */}
        <header className="flex justify-between items-center mb-16 py-4">
          <Link href="/journal" className="text-zinc-500 hover:text-white transition-colors text-xs flex items-center gap-1.5 select-none">
            <ArrowLeft className="w-3.5 h-3.5" />
            Kembali menulis
          </Link>
          <h1 className="text-xs font-medium uppercase tracking-widest text-zinc-500">Journal Entries</h1>
        </header>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-[pulse_1.4s_ease-in-out_infinite]" />
            <p className="text-xs text-zinc-600 italic select-none">Opening journal...</p>
          </div>
        ) : journals.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center space-y-4 max-w-sm mx-auto">
            <BookOpen className="w-6 h-6 text-zinc-800" />
            <h2 className="text-sm font-medium text-zinc-300">Nothing written yet.</h2>
            <p className="text-xs text-zinc-600 leading-relaxed px-6">
              Write some entries to capture your emotional flow. Each entry will sit quietly here.
            </p>
            <Link
              href="/journal"
              className="mt-2 flex items-center gap-1.5 bg-zinc-900 border border-white/5 hover:border-white/10 text-zinc-400 hover:text-white px-4 py-2 rounded-xl text-xs transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Write entry
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {journals.map((journal) => (
              <div 
                key={journal.id} 
                className="p-6 rounded-2xl bg-zinc-950/40 border border-white/5 hover:border-white/10 transition-colors duration-300 space-y-4"
              >
                <div className="flex justify-between items-start">
                  <h2 className="text-sm font-medium text-zinc-200">
                    {journal.title || "Untitled"}
                  </h2>
                  <div className="flex items-center gap-2">
                    {journal.mood_tag && (
                      <span className="px-2.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider font-semibold border bg-zinc-900 border-white/5 text-zinc-500">
                        {journal.mood_tag}
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-600 flex items-center gap-1 select-none">
                      <Calendar className="w-3 h-3" />
                      {new Date(journal.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                </div>
                <p className="text-zinc-400 text-xs leading-relaxed font-light line-clamp-4">
                  {journal.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quiet Footer */}
      <footer className="py-16 text-center text-[10px] text-zinc-700 select-none">
        Serenova • Trace gently.
      </footer>
    </main>
  );
}
