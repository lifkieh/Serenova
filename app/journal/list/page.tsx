"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
    <main className="min-h-screen bg-black text-white p-6 max-w-4xl mx-auto font-sans">
      <header className="flex justify-between items-center mb-12">
        <Link href="/journal" className="text-zinc-500 hover:text-white transition-colors text-sm">
          ← Back to writing
        </Link>
        <h1 className="text-xl font-medium text-zinc-200">Entries</h1>
      </header>

      {loading ? (
        <div className="text-zinc-600 text-center mt-20">Loading...</div>
      ) : journals.length === 0 ? (
        <div className="text-zinc-600 text-center mt-20">No entries yet.</div>
      ) : (
        <div className="space-y-6">
          {journals.map((journal) => (
            <div key={journal.id} className="p-6 rounded-2xl bg-zinc-900 border border-white/5 hover:border-white/10 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-lg font-medium text-zinc-200">
                  {journal.title || "Untitled"}
                </h2>
                <div className="flex items-center gap-3">
                  {journal.mood_tag && (
                    <span className="px-3 py-1 rounded-full bg-zinc-950 text-zinc-400 text-xs border border-white/5">
                      {journal.mood_tag}
                    </span>
                  )}
                  <span className="text-xs text-zinc-600">
                    {new Date(journal.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <p className="text-zinc-400 line-clamp-3 text-sm leading-relaxed">
                {journal.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
