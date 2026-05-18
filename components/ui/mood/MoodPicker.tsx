"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const MOODS = [
  "calm",
  "tired",
  "overwhelmed",
  "anxious",
  "lonely",
  "hopeful",
  "numb",
  "frustrated",
  "grateful",
];

const MOOD_LABELS: Record<string, Record<string, string>> = {
  en: {
    calm: "calm",
    tired: "tired",
    overwhelmed: "overwhelmed",
    anxious: "anxious",
    lonely: "lonely",
    hopeful: "hopeful",
    numb: "numb",
    frustrated: "frustrated",
    grateful: "grateful"
  },
  id: {
    calm: "tenang",
    tired: "lelah",
    overwhelmed: "kewalahan",
    anxious: "cemas",
    lonely: "kesepian",
    hopeful: "optimis",
    numb: "hampa",
    frustrated: "frustrasi",
    grateful: "bersyukur"
  }
};

export default function MoodPicker({
  onSelect,
  className,
  lang = "en",
}: {
  onSelect?: (mood: string) => void;
  className?: string;
  lang?: "en" | "id";
}) {
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSelect = async (mood: string) => {
    if (selectedMood === mood) return;
    setSelectedMood(mood);
    setLoading(true);

    try {
      await fetch("/api/mood", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mood }),
      });
      if (onSelect) onSelect(mood);
    } catch (error) {
      console.error("Failed to save mood", error);
    } finally {
      setLoading(false);
    }
  };

  const labels = MOOD_LABELS[lang] || MOOD_LABELS.en;

  return (
    <div className={cn("w-full overflow-x-auto pb-2 scrollbar-hide", className)}>
      <div className="flex items-center gap-2 px-1">
        {MOODS.map((mood) => (
          <button
            key={mood}
            onClick={() => handleSelect(mood)}
            disabled={loading && selectedMood !== mood}
            className={cn(
              "whitespace-nowrap px-4 py-1.5 rounded-full text-xs transition-colors duration-200 outline-none",
              selectedMood === mood
                ? "bg-white text-black font-medium"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            )}
          >
            {labels[mood] || mood}
          </button>
        ))}
      </div>
    </div>
  );
}