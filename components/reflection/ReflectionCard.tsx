import React from "react";
import { ChevronDown, ChevronUp, Calendar } from "lucide-react";

type Reflection = {
  id: string;
  type: "weekly" | "monthly";
  period_start: string;
  period_end: string;
  content: string;
  created_at: string;
};

type ReflectionCardProps = {
  reflection: Reflection;
  isExpanded: boolean;
  onToggle: () => void;
  formatPeriod: (start: string, end: string) => string;
};

export default function ReflectionCard({ reflection, isExpanded, onToggle, formatPeriod }: ReflectionCardProps) {
  const previewText = reflection.content.slice(0, 140) + (reflection.content.length > 140 ? "..." : "");

  return (
    <article
      onClick={onToggle}
      className="p-6 rounded-2xl bg-zinc-950/40 border border-white/5 hover:border-white/10 transition-all duration-300 cursor-pointer space-y-4"
    >
      <div className="flex justify-between items-center text-xs">
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider font-semibold border ${
            reflection.type === "monthly"
              ? "bg-zinc-900 border-zinc-700/40 text-zinc-400"
              : "bg-black border-white/5 text-zinc-500"
          }`}>
            {reflection.type}
          </span>
          <span className="text-[10px] text-zinc-600 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatPeriod(reflection.period_start, reflection.period_end)}
          </span>
        </div>
        <div className="text-zinc-600 group-hover:text-zinc-400 transition-colors">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      <p className={`text-zinc-300 text-sm leading-relaxed font-light transition-all ${
        isExpanded ? "line-clamp-none font-serif leading-loose" : "line-clamp-2"
      }`}>
        {isExpanded ? reflection.content : previewText}
      </p>

      {!isExpanded && reflection.content.length > 140 && (
        <span className="text-[10px] text-zinc-600 block pt-1 hover:text-zinc-400 transition-colors">
          Read checkpoint →
        </span>
      )}
    </article>
  );
}
