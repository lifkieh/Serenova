import { getSupabase } from "@/lib/supabase";
import { Logger } from "../logging/logger";

// ─────────────────────────────────────────────────────────────
// Forbidden Phrases — hard gate on therapist/coaching language
// ─────────────────────────────────────────────────────────────

const FORBIDDEN_PHRASES = [
  "healing journey", "you are transforming", "the universe",
  "you got this", "you've grown", "it's okay to feel",
  "be kind to yourself", "self-care", "this too shall pass",
  "proud of you", "you are enough", "validated",
  "sit with your feelings", "hold space", "safe space",
  "i'm here for you", "you're not alone", "believe in yourself",
];

export function validateReflection(text: string): boolean {
  const lower = text.toLowerCase();
  return !FORBIDDEN_PHRASES.some((phrase) => lower.includes(phrase));
}

// ─────────────────────────────────────────────────────────────
// Verbosity Preference Detection
// ─────────────────────────────────────────────────────────────

export function detectVerbosityPreference(
  messageHistory: { role: string; content: string }[]
): "concise" | "contemplative" | "observational" {
  const userMessages = messageHistory
    .filter((m) => m.role === "user")
    .map((m) => m.content);

  if (userMessages.length === 0) return "observational";

  const avgLength =
    userMessages.reduce((sum, m) => sum + m.length, 0) / userMessages.length;

  if (avgLength < 80) return "concise";
  if (avgLength > 200) return "contemplative";
  return "observational";
}

// ─────────────────────────────────────────────────────────────
// Reflection Context Builder
// ─────────────────────────────────────────────────────────────

export function buildReflectionContext(data: {
  emotionalMemories: string[];
  recurringPatterns: string[];
  chatExcerpts: string[];
  moodTrends: string[];
  emotionalShifts: string[];
  lang: "id" | "en";
  type: "weekly" | "monthly";
}): string {
  return `
EMOTIONAL MEMORIES (recent):
${data.emotionalMemories.slice(0, 8).join("\n")}

RECURRING PATTERNS:
${data.recurringPatterns.slice(0, 5).join("\n")}

NOTABLE CHAT EXCERPTS:
${data.chatExcerpts.slice(0, 5).join("\n---\n")}

MOOD TRENDS:
${data.moodTrends.join(", ")}

EMOTIONAL SHIFTS:
${data.emotionalShifts.join("\n")}
  `.trim();
}

// ─────────────────────────────────────────────────────────────
// System Prompts
// ─────────────────────────────────────────────────────────────

export function getWeeklySystemPrompt(lang: string, verbosity: string, context: string): string {
  return `You are a quiet, attentive observer. You've been reading this person's recent conversations and emotional notes — not to analyze, but to witness.

Write a weekly reflection in ${lang === "id" ? "Indonesian" : "English"}.

Structure (follow this order):
A. Emotional Atmosphere — describe the overall texture of this week in 2–3 sentences. Not what happened. How it felt.
B. Pattern Observation — name one specific thing you noticed. Something honest, not generic.
C. Gentle Contrast — if there were lighter moments, acknowledge them without forcing optimism.
D. Closing — one or two sentences. Grounded. No resolution pressure.

Tone rules (non-negotiable):
- Sound like a calm, thoughtful person who paid attention — not a therapist, not a coach
- Lowercase preferred in Indonesian mode
- Imperfect sentences are fine. Poetic but grounded.
- Never exceed 5 short paragraphs
- If you have nothing meaningful to say about a section, skip it

Hard forbidden phrases:
"healing journey", "you are transforming", "the universe", "you got this",
"you've grown", "it's okay to feel", "be kind to yourself", "self-care",
"this too shall pass", "proud of you", "you are enough",
"validated", "sit with your feelings", "hold space"

Context provided:
${context}

User writing style preference: ${verbosity}`;
}

export function getMonthlySystemPrompt(lang: string, verbosity: string, context: string): string {
  return `You are a quiet, honest witness. You've been reading this person's conversations and emotional notes from the past month.

Write a monthly reflection in ${lang === "id" ? "Indonesian" : "English"}.

Monthly reflections are different from weekly ones. They look at:
- Recurring emotional cycles (what keeps coming back)
- Small identity shifts (how they seem to be moving, without labeling it growth)
- Patterns only visible from a longer view
- What they carry, and what occasionally lifts

Structure:
A. The Month's Texture — 2–3 sentences on the overall emotional atmosphere of this month
B. What Kept Returning — one recurring pattern, named honestly
C. A Shift Worth Noting — something small that changed, if anything did. If nothing shifted, say so honestly.
D. What You Carry — acknowledge what's still present without trying to resolve it
E. Closing — short, grounded, no prescription

Same tone rules as weekly reflection.
Same forbidden phrases.

Context provided:
${context}

User writing style preference: ${verbosity}`;
}

// ─────────────────────────────────────────────────────────────
// Data Fetchers
// ─────────────────────────────────────────────────────────────

/**
 * Count distinct conversation sessions in a date range for a user.
 */
export async function countRecentSessions(userId: string, dayRange: number): Promise<number> {
  const supabase = getSupabase();
  const since = new Date();
  since.setDate(since.getDate() - dayRange);

  const { count, error } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since.toISOString());

  if (error) {
    Logger.warn({ action: "COUNT_SESSIONS_ERROR", userId, error: error.message });
    return 0;
  }
  return count ?? 0;
}

/**
 * Fetch all data needed to build a reflection context for the given time range.
 * Returns raw data structures that buildReflectionContext can assemble.
 */
export async function fetchReflectionData(userId: string, dayRange: number) {
  const supabase = getSupabase();
  const since = new Date();
  since.setDate(since.getDate() - dayRange);
  const sinceISO = since.toISOString();

  // 1. Emotional memories from memory_context
  const { data: memories } = await supabase
    .from("memory_context")
    .select("theme, frequency")
    .eq("user_id", userId)
    .order("frequency", { ascending: false })
    .limit(8);

  // 2. Mood trends
  const { data: moods } = await supabase
    .from("moods")
    .select("mood, created_at")
    .eq("user_id", userId)
    .gte("created_at", sinceISO)
    .order("created_at", { ascending: true });

  // 3. Conversations in range
  const { data: conversations } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", userId)
    .gte("created_at", sinceISO)
    .order("updated_at", { ascending: false })
    .limit(10);

  // 4. Chat messages — fetch user messages, sorted by length (longest = emotionally significant proxy)
  let chatExcerpts: string[] = [];
  let allUserMessages: { role: string; content: string }[] = [];
  if (conversations && conversations.length > 0) {
    const convIds = conversations.map((c) => c.id);
    const { data: messages } = await supabase
      .from("messages")
      .select("role, content, created_at")
      .in("conversation_id", convIds)
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(200);

    if (messages) {
      allUserMessages = messages.map((m) => ({ role: m.role, content: m.content }));

      // Pick 5 longest user messages as emotionally significant excerpts
      const userMsgs = messages
        .filter((m) => m.role === "user")
        .sort((a, b) => b.content.length - a.content.length)
        .slice(0, 5);

      chatExcerpts = userMsgs.map((m) => m.content);
    }
  }

  // 5. Journal entries in range
  const { data: journals } = await supabase
    .from("journals")
    .select("title, content, mood_tag, created_at")
    .eq("user_id", userId)
    .gte("created_at", sinceISO)
    .order("created_at", { ascending: false })
    .limit(10);

  // 6. Existing weekly reflections (for monthly context)
  let weeklyReflections: string[] = [];
  if (dayRange >= 30) {
    const { data: reflections } = await supabase
      .from("reflections")
      .select("content")
      .eq("user_id", userId)
      .eq("type", "weekly")
      .gte("created_at", sinceISO);

    if (reflections) {
      weeklyReflections = reflections.map((r) => r.content);
    }
  }

  // Assemble structured data
  const emotionalMemories = [
    ...(memories?.map((m) => `${m.theme} (×${m.frequency})`) ?? []),
    ...(journals?.map((j) => `[${j.mood_tag || "none"}] ${j.title || ""}: ${j.content.slice(0, 100)}...`) ?? []),
  ];

  const recurringPatterns = [
    ...(memories?.map((m) => m.theme) ?? []),
  ];

  const moodTrends = moods?.map((m) => m.mood) ?? [];

  // Detect shifts: compare first half vs second half of mood data
  const emotionalShifts: string[] = [];
  if (moods && moods.length >= 4) {
    const midpoint = Math.floor(moods.length / 2);
    const firstHalf = moods.slice(0, midpoint).map((m) => m.mood);
    const secondHalf = moods.slice(midpoint).map((m) => m.mood);
    const firstDominant = getMostFrequent(firstHalf);
    const secondDominant = getMostFrequent(secondHalf);
    if (firstDominant && secondDominant && firstDominant !== secondDominant) {
      emotionalShifts.push(`Shift observed: ${firstDominant} → ${secondDominant}`);
    }
  }

  // Add weekly reflections as context for monthly
  if (weeklyReflections.length > 0) {
    emotionalMemories.push(
      ...weeklyReflections.map((r, i) => `Weekly reflection ${i + 1}: ${r.slice(0, 150)}...`)
    );
  }

  return {
    emotionalMemories,
    recurringPatterns,
    chatExcerpts,
    moodTrends,
    emotionalShifts,
    allUserMessages,
  };
}

function getMostFrequent(arr: string[]): string | null {
  if (arr.length === 0) return null;
  const freq: Record<string, number> = {};
  for (const item of arr) {
    freq[item] = (freq[item] || 0) + 1;
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
}
