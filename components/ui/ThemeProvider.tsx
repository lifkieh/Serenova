"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type MoodContextType = {
  currentMood: string | null;
  setMood: (mood: string) => void;
};

const MoodContext = createContext<MoodContextType>({ currentMood: null, setMood: () => {} });

export function useMood() {
  return useContext(MoodContext);
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentMood, setCurrentMood] = useState<string | null>(null);

  useEffect(() => {
    // Fetch latest mood on mount
    fetch("/api/mood")
      .then(res => res.json())
      .then(json => {
        if (json.data && json.data.length > 0) {
          setCurrentMood(json.data[0].mood);
        }
      })
      .catch(console.error);
  }, []);

  // Soft mood-based UI adjustments
  const getMoodStyles = () => {
    switch (currentMood) {
      case "exhausted":
      case "tired":
        return "bg-black text-zinc-500 transition-all duration-1000";
      case "hopeful":
      case "grateful":
        return "bg-[#0a0a09] text-zinc-300 transition-all duration-700"; // Slightly warmer tint
      case "anxious":
      case "overwhelmed":
        return "bg-[#050505] text-zinc-400 transition-all duration-700";
      default:
        // Calm / neutral
        return "bg-black text-zinc-300 transition-all duration-700";
    }
  };

  return (
    <MoodContext.Provider value={{ currentMood, setMood: setCurrentMood }}>
      <div className={cn("min-h-screen w-full", getMoodStyles())}>
        {children}
      </div>
    </MoodContext.Provider>
  );
}
