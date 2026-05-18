/**
 * Centralized Model Strategy Groups for OpenRouter
 * Enforces strong typing and clear fallback hierarchies.
 *
 * Model Selection Rationale (aligned with Serenova's purpose):
 * ─────────────────────────────────────────────────────────────
 * Serenova is a calm, late-night reflective companion.
 * Models are chosen for: instruction adherence, low hallucination,
 * emotional nuance, Indonesian+English fluency, and throughput reliability.
 *
 * - gpt-oss-120b:free    → 117B MoE, 5.1B active. Strongest instruction compliance
 *                           and lowest hallucination rate among free models.
 *                           150B token throughput = extremely reliable.
 * - qwen3-next-80b:free  → 80B MoE, 3B active. No thinking traces, clean output.
 *                           262K context (best for long conversations).
 *                           Strong Asian-language training = best Indonesian fluency.
 * - gemini-2.5-flash-lite → Fast, reliable paid-tier backup. Always available.
 */

// Primary chat models — ordered by Serenova alignment fit (Journal/Reflective mode)
export const CHAT_PRIMARY: string[] = [
  "groq::llama-3.3-70b-versatile",  // ultra-fast, primary
  "openai/gpt-oss-120b",             // quality fallback
  "google/gemini-3.1-pro-preview",   // reliable fallback
  "google/gemini-2.5-flash-lite"     // last resort
];

// Chill & Talk mode models — separate casual/Gen-Z supportive chain of models
// Completely disjoint from CHAT_PRIMARY and contains no Gemini models
export const CHAT_CHILL: string[] = [
  "groq::llama-3.3-70b-versatile",           // ultra-fast, free via Groq
  "meta-llama/llama-3.3-70b-instruct:free",  // OpenRouter free fallback
  "google/gemini-2.5-flash-lite",             // paid fallback
  "mistralai/mistral-small-3.2-24b-instruct-2506",
];

// Groq models — ultra-low latency, separate provider
export const GROQ_CHAT: string[] = [
  "groq::llama-3.3-70b-versatile",
  "groq::llama3-8b-8192",
];

export const GROQ_CHILL: string[] = [
  "groq::llama-3.3-70b-versatile",
  "groq::llama3-8b-8192",
];

// Reflection generation — needs deep instruction adherence for persona consistency
export const REFLECTION_PREMIUM: string[] = [
  "openai/gpt-oss-120b",
  "google/gemini-2.5-flash-lite"
];

// Safety evaluation — needs reliable, fast, deterministic JSON output
export const SAFETY_EVALUATOR: string[] = [
  "google/gemini-2.5-flash-lite"
];

export const EMBEDDING_MODEL = "text-embedding-004";

// Fast, reliable models only — no free-tier fallbacks that timeout.
// Used for preflight safety classification and tone evaluation.
export const SAFETY_QUICK: string[] = [
  "google/gemini-2.5-flash-lite",
];

export type ModelGroup =
  | "CHAT_PRIMARY"
  | "CHAT_CHILL"
  | "REFLECTION_PREMIUM"
  | "SAFETY_EVALUATOR"
  | "SAFETY_QUICK"
  | "GROQ_CHAT"
  | "GROQ_CHILL";

export interface ModelTimeoutMetadata {
  firstChunkTimeoutMs: number;
  idleTimeoutMs: number;
}

const DEFAULT_TIMEOUTS: ModelTimeoutMetadata = {
  firstChunkTimeoutMs: 15000,
  idleTimeoutMs: 30000,
};
const MODEL_TIMEOUT_METADATA: Record<string, ModelTimeoutMetadata> = {
  "google/gemini-2.5-flash-lite": {
    firstChunkTimeoutMs: 12000,
    idleTimeoutMs: 25000,
  },
  "google/gemini-3.1-pro-preview": {
    firstChunkTimeoutMs: 15000,
    idleTimeoutMs: 30000,
  },
  "openai/gpt-oss-120b": {
    firstChunkTimeoutMs: 20000,  // MoE routing may add slight cold-start
    idleTimeoutMs: 30000,
  },
  "meta-llama/llama-3.3-70b-instruct:free": {
    firstChunkTimeoutMs: 20000, // Free tier can have slight queue delay
    idleTimeoutMs: 30000,
  },
  "mistralai/mistral-small-3.2-24b-instruct-2506": {
    firstChunkTimeoutMs: 15000,
    idleTimeoutMs: 28000,
  },
  "groq::llama-3.3-70b-versatile": {
    firstChunkTimeoutMs: 5000,  // Groq is extremely fast
    idleTimeoutMs: 15000,
  },
  "groq::llama3-8b-8192": {
    firstChunkTimeoutMs: 3000,
    idleTimeoutMs: 10000,
  },
};

export function getModelTimeouts(model: string): ModelTimeoutMetadata {
  return MODEL_TIMEOUT_METADATA[model] || DEFAULT_TIMEOUTS;
}

/**
 * Get fallback chain for a model group
 */
export function getModelFallbackChain(group: ModelGroup): string[] {
  switch (group) {
    case "CHAT_PRIMARY":
      return CHAT_PRIMARY;
    case "CHAT_CHILL":
      return CHAT_CHILL;
    case "REFLECTION_PREMIUM":
      return REFLECTION_PREMIUM;
    case "SAFETY_EVALUATOR":
      return SAFETY_EVALUATOR;
    case "SAFETY_QUICK":
      return SAFETY_QUICK;
    case "GROQ_CHAT":
      return GROQ_CHAT;
    case "GROQ_CHILL":
      return GROQ_CHILL;
    default:
      return CHAT_PRIMARY;
  }
}
