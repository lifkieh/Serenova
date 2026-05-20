"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Dashboard() {
  const [role, setRole] = useState("");

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => setRole(data.role))
      .catch(() => {});
  }, []);

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center font-sans text-zinc-300 p-6">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-medium tracking-wide text-white">Serenova</h1>
          <p className="text-zinc-500 text-sm">Choose your space.</p>
        </div>

        <div className="space-y-4">
          <Link
            href="/chat/journal"
            className="block w-full p-6 bg-zinc-900/50 hover:bg-zinc-900 border border-white/5 hover:border-white/10 rounded-2xl transition-all text-left group"
          >
            <h2 className="text-lg font-medium text-white mb-2 group-hover:text-emerald-400 transition-colors">Journal Mode</h2>
            <p className="text-sm text-zinc-500">A quiet space for reflection, emotional processing, and deeper conversations.</p>
          </Link>

          <Link
            href="/chat/chill"
            className="block w-full p-6 bg-zinc-900/50 hover:bg-zinc-900 border border-white/5 hover:border-white/10 rounded-2xl transition-all text-left group"
          >
            <h2 className="text-lg font-medium text-white mb-2 group-hover:text-blue-400 transition-colors">Chill Mode</h2>
            <p className="text-sm text-zinc-500">Hang out, play games, generate images, and have some casual fun.</p>
          </Link>
        </div>

        {role === "guest" && (
          <p className="text-xs text-zinc-600 mt-8">You are currently in a Guest Session.</p>
        )}
      </div>
    </main>
  );
}