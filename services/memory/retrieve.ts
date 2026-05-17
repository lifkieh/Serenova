import { getSupabase } from "@/lib/supabase";

type ScoredMemory = {
    theme: string;
    score: number;
};

/**
 * Advanced contextual memory retrieval.
 * 
 * Scoring: hybrid of frequency, importance, emotional relevance, recency.
 * Suppression: deduplicates similar themes, suppresses repetitive injections.
 * Decay: penalizes stale, low-frequency themes.
 * Max injected: 3 themes.
 */
export async function getContextualMemory(
    userId: string,
    currentMood?: string,
    recentlyInjected?: string[]
): Promise<string> {
    const supabase = getSupabase();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: memories } = await supabase
        .from("memory_context")
        .select("theme, frequency, importance_score, emotional_relevance, last_seen, type")
        .eq("user_id", userId)
        .eq("is_active", true);

    if (!memories || memories.length === 0) return "";

    // Step 1: Deduplicate by normalized theme
    const deduplicated = new Map<string, typeof memories[0]>();
    for (const mem of memories) {
        const key = mem.theme.toLowerCase().trim();
        const existing = deduplicated.get(key);
        if (!existing || (mem.frequency || 0) > (existing.frequency || 0)) {
            deduplicated.set(key, mem);
        }
    }

    // Step 2: Score each memory
    const scored: ScoredMemory[] = [];

    for (const mem of deduplicated.values()) {
        let score = 0;

        // Frequency weight (recurring themes matter more)
        score += Math.min((mem.frequency || 1) * 1.5, 15); // cap at 15

        // Importance weight
        score += (mem.importance_score || 0) * 2;

        // Emotional relevance weight
        score += (mem.emotional_relevance || 0) * 1.5;

        // Recency bonus/penalty
        const lastSeen = new Date(mem.last_seen);
        const daysSince = (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 3) {
            score += 4; // Very recent
        } else if (daysSince < 7) {
            score += 2; // Recent
        } else if (daysSince > 30 && (mem.frequency || 1) < 3) {
            score -= 3; // Decay: old and rare
        }

        // Type bonus: patterns and preferences are more stable
        if (mem.type === "pattern") score += 1;
        if (mem.type === "preference") score += 2;

        // Mood resonance bonus
        if (currentMood) {
            const moodResonance = getMoodResonance(mem.theme, currentMood);
            score += moodResonance;
        }

        // Repetition suppression: penalize recently injected themes
        if (recentlyInjected?.some(r => r.toLowerCase() === mem.theme.toLowerCase())) {
            score -= 5;
        }

        scored.push({ theme: mem.theme, score });
    }

    // Step 3: Sort and pick top 3
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 3).filter(s => s.score > 0);

    if (top.length === 0) return "";

    const themes = top.map(d => d.theme).join(", ");
    return `\n\n## Soft Context\nRecurring emotional themes for this user: ${themes}.\nUse this only to be more attuned — never reference it directly or use it manipulatively.`;
}

/**
 * Simple mood-to-theme resonance scoring.
 * Rewards themes that emotionally align with the user's current mood.
 */
function getMoodResonance(theme: string, mood: string): number {
    const t = theme.toLowerCase();
    const resonanceMap: Record<string, string[]> = {
        tired: ["exhaustion", "fatigue", "burnout", "sleep", "rest"],
        overwhelmed: ["pressure", "stress", "too much", "overload", "burden"],
        anxious: ["worry", "fear", "uncertainty", "nervous", "anxiety"],
        lonely: ["isolation", "loneliness", "alone", "disconnect"],
        frustrated: ["anger", "stuck", "irritation", "blocked"],
        hopeful: ["hope", "future", "possibility", "change"],
        grateful: ["gratitude", "appreciation", "thankful"],
        calm: ["peace", "quiet", "balance", "stability"],
        numb: ["detach", "empty", "void", "nothing"],
    };

    const keywords = resonanceMap[mood] || [];
    for (const kw of keywords) {
        if (t.includes(kw)) return 3;
    }
    return 0;
}

