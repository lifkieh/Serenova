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
    drained: {
        promptSuffix: "The user seems drained. Keep responses shorter and calmer. Use gentle pacing, low stimulation, and avoid asking questions. Less is more.",
        uiHint: "subdued",
    },
    overwhelmed: {
        promptSuffix: "The user feels overwhelmed. Use grounding language and simpler sentence structures. Avoid cognitive overload. Be present, not probing.",
        uiHint: "gentle",
    },
    restless: {
        promptSuffix: "The user feels restless. Keep a grounded, steady tone. Avoid hypotheticals or open-ended questions that could spiral.",
        uiHint: "gentle",
    },
    thoughtful: {
        promptSuffix: "The user is in a thoughtful space. You can offer slightly deeper reflections with a calm, observational tone.",
        uiHint: "open",
    },
    lonely: {
        promptSuffix: "The user is lonely. Be warm and present, but strictly bounded. NEVER sound like a savior, do not use 'I am always here for you', and never reinforce dependency.",
        uiHint: "gentle",
    },
    lighter: {
        promptSuffix: "The user seems in a lighter emotional space. Match that energy gently without being overly enthusiastic or motivational.",
        uiHint: "open",
    },
};

export function getEmotionalPacing(mood: string | null): PacingHint {
    if (!mood) return { promptSuffix: "", uiHint: "default" };
    return PACING_MAP[mood] || { promptSuffix: "", uiHint: "default" };
}
