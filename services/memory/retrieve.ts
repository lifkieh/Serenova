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

        // 1. Frequency weight (recurring themes matter more)
        score += Math.min((mem.frequency || 1) * 2.0, 15); // Cap frequency contribution at 15

        // 2. Enhanced Emotional Importance & Relevance Scaling
        score += (mem.importance_score || 0) * 2.5;
        score += (mem.emotional_relevance || 0) * 2.0;

        // 3. Continuous Freshness Decay (Exponential half-life of 7 days)
        const lastSeen = new Date(mem.last_seen);
        const daysSince = Math.max(0, (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60 * 24));
        
        // Freshness boost: up to +6 points for brand new items, decaying exponentially
        score += Math.max(0, 6 * Math.exp(-daysSince / 7));

        // Long-term active theme support: penalize if neglected for over 30 days
        if (daysSince > 30 && (mem.frequency || 1) < 4) {
            score -= 4;
        }

        // 4. Stable Type weights
        if (mem.type === "pattern") score += 1.5;
        if (mem.type === "preference") score += 2.5;

        // 5. Mood Resonance weighting
        if (currentMood) {
            const moodResonance = getMoodResonance(mem.theme, currentMood);
            score += moodResonance * 1.5;
        }

        // 6. Anti-Repetition Suppression
        if (recentlyInjected?.some(r => r.toLowerCase().trim() === mem.theme.toLowerCase().trim())) {
            score -= 10; // Stricter penalty to completely avoid repetitive theme injections
        }

        scored.push({ theme: mem.theme, score });
    }

    // Step 3: Sort candidates
    scored.sort((a, b) => b.score - a.score);

    // Step 4: Active Diversification (Penalize semantic/word redundancies)
    const selected: ScoredMemory[] = [];
    const chosenWords = new Set<string>();

    for (const item of scored) {
        if (item.score <= 0) continue;
        if (selected.length >= 3) break;

        const words = item.theme.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const overlaps = words.filter(w => chosenWords.has(w));

        // If theme has semantic word overlaps with previously chosen themes, penalize it heavily to force variety
        const adjustedScore = item.score - (overlaps.length * 4);

        if (adjustedScore > 0 || selected.length === 0) {
            selected.push(item);
            words.forEach(w => chosenWords.add(w));
        }
    }

    if (selected.length === 0) return "";

    const themes = selected.map(d => d.theme).join(", ");
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

