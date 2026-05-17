"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SoftAnalytics = {
    totalJournals: number;
    topMoods: { mood: string; count: number }[];
    recentThemes: string[];
};

export default function AnalyticsPage() {
    const [data, setData] = useState<SoftAnalytics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/analytics")
            .then(res => res.json())
            .then(json => {
                if (json.data) setData(json.data);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <main className="min-h-screen bg-black text-white flex items-center justify-center">
                <p className="text-zinc-600 text-sm">Loading...</p>
            </main>
        );
    }

    if (!data) {
        return (
            <main className="min-h-screen bg-black text-white flex items-center justify-center">
                <p className="text-zinc-600 text-sm">No data available yet.</p>
            </main>
        );
    }

    const maxMoodCount = data.topMoods.length > 0 ? Math.max(...data.topMoods.map(m => m.count)) : 1;

    return (
        <main className="min-h-screen bg-black text-white p-6 max-w-3xl mx-auto font-sans">
            <header className="flex justify-between items-center mb-16">
                <Link href="/dashboard" className="text-zinc-500 hover:text-white transition-colors text-sm">
                    ← Back
                </Link>
                <h1 className="text-lg font-medium text-zinc-300">Emotional Rhythm</h1>
            </header>

            {/* Journaling frequency */}
            <section className="mb-16">
                <p className="text-xs text-zinc-600 uppercase tracking-widest mb-4">Reflection Entries</p>
                <p className="text-5xl font-light text-zinc-200">{data.totalJournals}</p>
                <p className="text-xs text-zinc-600 mt-2">journal entries total</p>
            </section>

            {/* Emotional landscape */}
            {data.topMoods.length > 0 && (
                <section className="mb-16">
                    <p className="text-xs text-zinc-600 uppercase tracking-widest mb-6">Emotional Landscape</p>
                    <div className="space-y-4">
                        {data.topMoods.map((m) => (
                            <div key={m.mood} className="flex items-center gap-4">
                                <span className="w-24 text-sm text-zinc-400">{m.mood}</span>
                                <div className="flex-1 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-zinc-600 rounded-full transition-all duration-1000"
                                        style={{ width: `${(m.count / maxMoodCount) * 100}%` }}
                                    />
                                </div>
                                <span className="text-xs text-zinc-600 w-8 text-right">{m.count}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Recurring themes */}
            {data.recentThemes.length > 0 && (
                <section className="mb-16">
                    <p className="text-xs text-zinc-600 uppercase tracking-widest mb-6">Recurring Themes</p>
                    <div className="flex flex-wrap gap-2">
                        {data.recentThemes.map((theme, i) => (
                            <span
                                key={i}
                                className="px-4 py-2 rounded-full bg-zinc-900 border border-white/5 text-zinc-400 text-xs"
                            >
                                {theme}
                            </span>
                        ))}
                    </div>
                </section>
            )}

            {/* Navigational links */}
            <section className="border-t border-white/5 pt-8 flex gap-4">
                <Link href="/reflections" className="text-xs text-zinc-500 hover:text-white transition-colors">
                    View Reflections →
                </Link>
                <Link href="/journal/list" className="text-xs text-zinc-500 hover:text-white transition-colors">
                    View Journal Entries →
                </Link>
            </section>
        </main>
    );
}
