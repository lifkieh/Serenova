"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Sparkles, BookOpen, Calendar, ArrowLeft } from "lucide-react";

type Reflection = {
    id: string;
    type: "weekly" | "monthly";
    period_start: string;
    period_end: string;
    content: string;
    created_at: string;
};

type FilterType = "all" | "weekly" | "monthly";

export default function ReflectionsPage() {
    const [reflections, setReflections] = useState<Reflection[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [filter, setFilter] = useState<FilterType>("all");
    const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

    useEffect(() => {
        loadReflections();
    }, []);

    async function loadReflections() {
        try {
            const res = await fetch("/api/reflections");
            const json = await res.json();
            if (json.data) setReflections(json.data);
        } catch (error) {
            console.error("Failed to load reflections", error);
        } finally {
            setLoading(false);
        }
    }

    async function generateReflection() {
        setGenerating(true);
        try {
            await fetch("/api/reflections", { method: "POST" });
            await loadReflections();
        } catch (error) {
            console.error("Failed to generate reflection", error);
        } finally {
            setGenerating(false);
        }
    }

    function toggleExpand(id: string) {
        setExpandedIds(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    }

    function formatPeriod(start: string, end: string) {
        const s = new Date(start);
        const e = new Date(end);
        return `${s.toLocaleDateString(undefined, { month: "short", day: "numeric" })} — ${e.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
    }

    const filteredReflections = reflections.filter(r => {
        if (filter === "all") return true;
        return r.type === filter;
    });

    return (
        <main className="min-h-screen bg-black text-zinc-300 p-6 max-w-2xl mx-auto font-sans flex flex-col justify-between">
            <div>
                {/* Header */}
                <header className="flex justify-between items-center mb-16 py-4">
                    <Link href="/dashboard" className="text-zinc-500 hover:text-white transition-colors text-xs flex items-center gap-1.5 select-none">
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Kembali
                    </Link>
                    <h1 className="text-xs font-medium uppercase tracking-widest text-zinc-500">Emotional Archive</h1>
                </header>

                {/* Info & Action section */}
                <div className="mb-12 bg-zinc-950/40 border border-white/5 rounded-2xl p-6 transition-all hover:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h2 className="text-sm font-medium text-zinc-200 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-zinc-500" />
                            Reflective Checkpoint
                        </h2>
                        <p className="text-xs text-zinc-600 leading-relaxed max-w-xs">
                            Gently compiles recent journals, moods, and recurring themes into a quiet synthesis.
                        </p>
                    </div>
                    <button
                        onClick={generateReflection}
                        disabled={generating}
                        className="self-start sm:self-center px-4 py-2.5 rounded-xl bg-zinc-900 border border-white/5 text-xs text-zinc-400 hover:text-white hover:border-white/10 transition-all disabled:opacity-40 select-none shrink-0"
                    >
                        {generating ? "Synthesizing..." : "Generate Reflection"}
                    </button>
                </div>

                {/* Filter Pills */}
                {reflections.length > 0 && (
                    <div className="flex items-center gap-2 mb-8 bg-zinc-950/20 border border-white/5 rounded-full p-[2px] w-fit">
                        {(["all", "weekly", "monthly"] as FilterType[]).map((t) => (
                            <button
                                key={t}
                                onClick={() => setFilter(t)}
                                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all capitalize select-none ${
                                    filter === t 
                                        ? "bg-zinc-900 text-white border border-white/5" 
                                        : "text-zinc-500 hover:text-zinc-300"
                                }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                )}

                {/* Core Experience View */}
                {loading ? (
                    <div className="flex flex-col items-center gap-3 py-20">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-[pulse_1.4s_ease-in-out_infinite]" />
                        <p className="text-xs text-zinc-600 italic select-none">Opening archives...</p>
                    </div>
                ) : filteredReflections.length === 0 ? (
                    <div className="text-center py-20 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center space-y-4 max-w-sm mx-auto">
                        <BookOpen className="w-6 h-6 text-zinc-800" />
                        <p className="text-xs text-zinc-500 leading-relaxed px-6">
                            {filter === "all"
                                ? "No reflections archived yet. As you write journal entries, quiet summaries will be compiled here."
                                : `No ${filter} reflections archived yet.`}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {filteredReflections.map((r) => {
                            const isExpanded = !!expandedIds[r.id];
                            const previewText = r.content.slice(0, 140) + (r.content.length > 140 ? "..." : "");

                            return (
                                <article
                                    key={r.id}
                                    onClick={() => toggleExpand(r.id)}
                                    className="p-6 rounded-2xl bg-zinc-950/40 border border-white/5 hover:border-white/10 transition-all duration-300 cursor-pointer space-y-4"
                                >
                                    {/* Meta Header */}
                                    <div className="flex justify-between items-center text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider font-semibold border ${
                                                r.type === "monthly" 
                                                    ? "bg-zinc-900 border-zinc-700/40 text-zinc-400" 
                                                    : "bg-black border-white/5 text-zinc-500"
                                            }`}>
                                                {r.type}
                                            </span>
                                            <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {formatPeriod(r.period_start, r.period_end)}
                                            </span>
                                        </div>
                                        <div className="text-zinc-600 group-hover:text-zinc-400 transition-colors">
                                            {isExpanded ? (
                                                <ChevronUp className="w-4 h-4" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <p className={`text-zinc-300 text-sm leading-relaxed font-light transition-all ${
                                        isExpanded ? "line-clamp-none font-serif leading-loose" : "line-clamp-2"
                                    }`}>
                                        {isExpanded ? r.content : previewText}
                                    </p>

                                    {/* Read more tip */}
                                    {!isExpanded && r.content.length > 140 && (
                                        <span className="text-[10px] text-zinc-600 block pt-1 hover:text-zinc-400 transition-colors">
                                            Read checkpoint →
                                        </span>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Quiet Footer */}
            <footer className="py-16 text-center text-[10px] text-zinc-700 select-none">
                Serenova • Read and breathe.
            </footer>
        </main>
    );
}
