/**
 * Centralized Model Strategy Groups for OpenRouter
 * Enforces strong typing and clear fallback hierarchies.
 */

export const CHAT_FAST: string[] = [
  "qwen/qwen3-next-80b-a3b-instruct:free"
];

export const CHAT_BALANCED: string[] = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "openai/gpt-oss-120b:free"
];

export const REFLECTION_PREMIUM: string[] = [
  "openai/gpt-oss-120b:free",
  "nousresearch/hermes-3-405b-instruct:free"
];

export const SAFETY_EVALUATOR: string[] = [
  "qwen/qwen3-next-80b-a3b-instruct:free"
];

export const EMBEDDING_MODEL = "text-embedding-004";

export type ModelGroup = "CHAT_FAST" | "CHAT_BALANCED" | "REFLECTION_PREMIUM" | "SAFETY_EVALUATOR";

/**
 * Get fallback chain for a model group
 */
export function getModelFallbackChain(group: ModelGroup): string[] {
  switch (group) {
    case "CHAT_FAST":
      return [...CHAT_FAST, ...CHAT_BALANCED];
    case "CHAT_BALANCED":
      return [...CHAT_BALANCED, ...CHAT_FAST];
    case "REFLECTION_PREMIUM":
      return [...REFLECTION_PREMIUM, ...CHAT_BALANCED];
    case "SAFETY_EVALUATOR":
      return [...SAFETY_EVALUATOR, ...CHAT_FAST];
    default:
      return ["qwen/qwen3-next-80b-a3b-instruct:free"];
  }
}
