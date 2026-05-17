"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Reflection = {
    id: string;
    type: "weekly" | "monthly";
    period_start: string;
    period_end: string;
    content: string;
    created_at: string;
};

export default function ReflectionsPage() {
    const [reflections, setReflections] = useState<Reflection[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

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

    function formatPeriod(start: string, end: string) {
        const s = new Date(start);
        const e = new Date(end);
        return `${s.toLocaleDateString()} — ${e.toLocaleDateString()}`;
    }

    return (
        <main className="min-h-screen bg-black text-white p-6 max-w-3xl mx-auto font-sans">
            <header className="flex justify-between items-center mb-16">
                <Link href="/dashboard" className="text-zinc-500 hover:text-white transition-colors text-sm">
                    ← Back
                </Link>
                <h1 className="text-lg font-medium text-zinc-300">Reflections</h1>
            </header>

            {/* Generate button — passive, not pushed */}
            <div className="mb-12 flex items-center gap-4">
                <button
                    onClick={generateReflection}
                    disabled={generating}
                    className="px-5 py-2 rounded-full bg-zinc-900 border border-white/5 text-xs text-zinc-400 hover:text-white hover:border-white/20 transition-colors disabled:opacity-40"
                >
                    {generating ? "Generating..." : "Generate Weekly Reflection"}
                </button>
                <p className="text-xs text-zinc-700">Based on your recent journals, moods, and themes</p>
            </div>

            {loading ? (
                <p className="text-zinc-600 text-sm text-center mt-20">Loading...</p>
            ) : reflections.length === 0 ? (
                <div className="text-center mt-20">
                    <p className="text-zinc-600 text-sm">No reflections yet.</p>
                    <p className="text-zinc-700 text-xs mt-2">Write some journal entries first, then come back.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {reflections.map((r) => (
                        <article
                            key={r.id}
                            className="p-6 rounded-2xl bg-zinc-950 border border-white/5"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <span className="px-3 py-1 rounded-full bg-zinc-900 text-zinc-500 text-xs border border-white/5">
                                    {r.type}
                                </span>
                                <span className="text-xs text-zinc-600">
                                    {formatPeriod(r.period_start, r.period_end)}
                                </span>
                            </div>
                            <p className="text-zinc-300 text-sm leading-relaxed">
                                {r.content}
                            </p>
                        </article>
                    ))}
                </div>
            )}
        </main>
    );
}
