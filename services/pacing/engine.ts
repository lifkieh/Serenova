/**
 * Emotional Pacing Engine.
 * Adjusts system prompt behavior based on detected user mood.
 * Subtle — never manipulative, never therapeutic.
 */

type PacingHint = {
    promptSuffix: string;
    uiHint: "default" | "subdued" | "gentle" | "open";
};

const PACING_MAP: Record<string, PacingHint> = {
    tired: {
        promptSuffix: "The user seems exhausted. Keep responses shorter and calmer. Don't ask too many questions. Less is more.",
        uiHint: "subdued",
    },
    exhausted: {
        promptSuffix: "The user seems exhausted. Keep responses shorter and calmer. Don't ask too many questions. Less is more.",
        uiHint: "subdued",
    },
    overwhelmed: {
        promptSuffix: "The user feels overwhelmed. Use simpler sentence structures. Don't introduce new heavy topics. Be present, not probing.",
        uiHint: "gentle",
    },
    anxious: {
        promptSuffix: "The user seems anxious. Keep a grounded, steady tone. Avoid hypotheticals or open-ended questions that could spiral.",
        uiHint: "gentle",
    },
    hopeful: {
        promptSuffix: "The user seems in a lighter emotional space. You can be slightly more open-ended and warm, but stay grounded.",
        uiHint: "open",
    },
    grateful: {
        promptSuffix: "The user is in a reflective, appreciative space. Match that energy gently without being overly enthusiastic.",
        uiHint: "open",
    },
};

export function getEmotionalPacing(mood: string | null): PacingHint {
    if (!mood) return { promptSuffix: "", uiHint: "default" };
    return PACING_MAP[mood] || { promptSuffix: "", uiHint: "default" };
}
