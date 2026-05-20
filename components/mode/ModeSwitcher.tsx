import Link from "next/link";
import { Plus } from "lucide-react";

export default function ModeSwitcher({ currentMode }: { currentMode: "journal" | "chill" }) {
  if (currentMode === "journal") {
    return (
      <Link
        href="/chat/chill"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 border border-white/10 text-[10px] text-zinc-400 hover:text-white hover:border-white/20 transition-all font-medium shrink-0"
      >
        <Plus className="w-3 h-3" />
        Chill Mode
      </Link>
    );
  }

  return (
    <Link
      href="/chat/journal"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 border border-white/10 text-[10px] text-zinc-400 hover:text-white hover:border-white/20 transition-all font-medium shrink-0"
    >
      <Plus className="w-3 h-3" />
      Journal Mode
    </Link>
  );
}
