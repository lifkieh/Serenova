"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Calendar, Heart, Compass, ArrowLeft } from "lucide-react";

type SoftAnalytics = {
    totalJournals: number;
    topMoods: { mood: string; count: number }[];
    recentThemes: string[];
    recentMoods: { mood: string; created_at: string }[];
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
            <main className="min-h-screen bg-black text-zinc-400 flex items-center justify-center font-sans">
                <div className="flex flex-col items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-[pulse_1.4s_ease-in-out_infinite]" />
                    <p className="text-xs text-zinc-600 italic select-none">Retrieving rhythm...</p>
                </div>
            </main>
        );
    }

    // Empty state check
    const isEmpty = !data || (data.totalJournals === 0 && data.topMoods.length === 0);

    if (isEmpty) {
        return (
            <main className="min-h-screen bg-black text-zinc-400 p-6 flex flex-col justify-between max-w-2xl mx-auto font-sans">
                <header className="py-6">
                    <Link href="/dashboard" className="text-zinc-600 hover:text-zinc-300 transition-colors text-xs flex items-center gap-1.5 select-none">
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Kembali
                    </Link>
                </header>

                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 max-w-sm mx-auto">
                    <Compass className="w-8 h-8 text-zinc-800 stroke-[1.25]" />
                    <h2 className="text-sm font-medium text-zinc-300">Patterns begin quietly over time.</h2>
                    <p className="text-xs text-zinc-600 leading-relaxed">
                        Nothing written yet. Once you start logging your thoughts and moods, your emotional rhythm will gently surface here.
                    </p>
                    <Link
                        href="/chat/journal"
                        className="mt-4 inline-block bg-zinc-900 border border-white/5 hover:border-white/10 text-zinc-400 hover:text-white px-5 py-2 rounded-xl text-xs transition-all"
                    >
                        Tulis Jurnal Pertama
                    </Link>
                </div>

                <footer className="py-8 text-center text-[10px] text-zinc-700 select-none">
                    Serenova • Emotional Rhythm
                </footer>
            </main>
        );
    }

    const totalJournals = data?.totalJournals || 0;
    const topMoods = data?.topMoods || [];
    const recentThemes = data?.recentThemes || [];
    const recentMoods = data?.recentMoods || [];

    const maxMoodCount = topMoods.length > 0 ? Math.max(...topMoods.map(m => m.count)) : 1;

    function formatDate(dateStr: string) {
        const d = new Date(dateStr);
        return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }

    return (
        <main className="min-h-screen bg-black text-zinc-300 p-6 max-w-2xl mx-auto font-sans flex flex-col justify-between">
            <div>
                {/* Header */}
                <header className="flex justify-between items-center mb-16 py-4">
                    <Link href="/dashboard" className="text-zinc-500 hover:text-white transition-colors text-xs flex items-center gap-1.5 select-none">
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Kembali
                    </Link>
                    <h1 className="text-xs font-medium uppercase tracking-widest text-zinc-500">Emotional Rhythm</h1>
                </header>

                {/* Journaling Frequency Card */}
                <section className="mb-16 bg-zinc-950/40 border border-white/5 rounded-2xl p-6 transition-all hover:border-white/10">
                    <div className="flex items-center gap-2 mb-3">
                        <Calendar className="w-4 h-4 text-zinc-600" />
                        <span className="text-[10px] uppercase tracking-wider text-zinc-500">Reflective Records</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-light text-zinc-100">{totalJournals}</span>
                        <span className="text-xs text-zinc-600">silent entries recorded</span>
                    </div>
                </section>

                {/* Emotional Landscape (Monochrome Chart) */}
                {topMoods.length > 0 && (
                    <section className="mb-16">
                        <div className="flex items-center gap-2 mb-6">
                            <Heart className="w-4 h-4 text-zinc-600" />
                            <h2 className="text-[10px] uppercase tracking-widest text-zinc-500">Emotional Landscape</h2>
                        </div>
                        <div className="space-y-5">
                            {topMoods.map((m) => (
                                <div key={m.mood} className="space-y-1">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="capitalize text-zinc-400 font-medium">{m.mood}</span>
                                        <span className="text-[10px] text-zinc-600">{m.count} logs</span>
                                    </div>
                                    <div className="h-1 bg-zinc-950 rounded-full overflow-hidden border border-white/5">
                                        <div
                                            className="h-full bg-zinc-500 rounded-full transition-all duration-1000"
                                            style={{ width: `${(m.count / maxMoodCount) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Quiet Emotional Flow Timeline (Non-numerical Soft Timeline) */}
                {recentMoods.length > 0 && (
                    <section className="mb-16">
                        <div className="flex items-center gap-2 mb-8">
                            <Compass className="w-4 h-4 text-zinc-600" />
                            <h2 className="text-[10px] uppercase tracking-widest text-zinc-500">Recent Emotional Flow</h2>
                        </div>
                        <div className="relative pl-4 border-l border-white/5 space-y-6">
                            {recentMoods.map((rm, idx) => (
                                <div key={idx} className="relative flex items-center gap-4">
                                    {/* Timeline dot */}
                                    <span className="absolute -left-[21px] w-2.5 h-2.5 rounded-full bg-zinc-800 border-2 border-black flex items-center justify-center">
                                        {idx === 0 && <span className="w-1 h-1 rounded-full bg-zinc-400" />}
                                    </span>
                                    
                                    <div className="flex flex-col">
                                        <span className="text-xs text-zinc-400 capitalize">{rm.mood}</span>
                                        <span className="text-[9px] text-zinc-600">{formatDate(rm.created_at)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Recurring Themes */}
                {recentThemes.length > 0 && (
                    <section className="mb-16">
                        <div className="flex items-center gap-2 mb-6">
                            <Sparkles className="w-4 h-4 text-zinc-600" />
                            <h2 className="text-[10px] uppercase tracking-widest text-zinc-500">Recurring Themes</h2>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {recentThemes.map((theme, i) => (
                                <span
                                    key={i}
                                    className="px-3.5 py-1.5 rounded-xl bg-zinc-950/40 border border-white/5 text-zinc-400 text-xs hover:border-white/10 transition-colors"
                                >
                                    {theme}
                                </span>
                            ))}
                        </div>
                    </section>
                )}

                {/* Navigation Footer */}
                <section className="border-t border-white/10 pt-8 flex gap-6">
                    <Link href="/reflections" className="text-xs text-zinc-500 hover:text-white transition-colors">
                        View Reflections →
                    </Link>
                    <Link href="/journal/list" className="text-xs text-zinc-500 hover:text-white transition-colors">
                        View Journal Entries →
                    </Link>
                </section>
            </div>

            <footer className="py-12 text-center text-[10px] text-zinc-700 select-none">
                Serenova • Trace gently.
            </footer>
        </main>
    );
}
