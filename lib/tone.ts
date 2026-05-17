/**
 * Centralized emotional tone utility.
 * Ensures emotional consistency across languages.
 */

type EmotionalTone = {
    reflectionIntro: string;
    noDataYet: string;
    reflectionAvailable: string;
    journalPromptHint: string;
};

const TONES: Record<string, EmotionalTone> = {
    en: {
        reflectionIntro: "Here's what surfaced this week.",
        noDataYet: "Not enough to reflect on yet. That's okay.",
        reflectionAvailable: "Reflection available",
        journalPromptHint: "How are you feeling right now?",
    },
    id: {
        reflectionIntro: "Ini yang muncul minggu ini.",
        noDataYet: "Belum cukup untuk direfleksikan. Nggak apa-apa.",
        reflectionAvailable: "Refleksi tersedia",
        journalPromptHint: "Lagi ngerasa gimana sekarang?",
    },
};

export function getEmotionalTone(lang: string): EmotionalTone {
    return TONES[lang] || TONES["en"];
}
