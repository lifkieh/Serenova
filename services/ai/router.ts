import { getOpenRouterCompletion } from "./openrouter";
import { getModelFallbackChain, ModelGroup } from "./models";
import { Logger } from "../logging/logger";

/**
 * Executes a text completion with automated fallback rotation.
 * Automatically handles provider rate limits (429), timeouts, and network outages,
 * transitioning to alternative candidate models in the group's fallback list.
 */
export async function withModelFallback(
  fallbackChain: string[],
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  options?: {
    temperature?: number;
    max_tokens?: number;
    signal?: AbortSignal;
    timeoutMs?: number;
  }
): Promise<{ text: string; modelUsed: string }> {
  let retryCount = 0;
  let timeoutCount = 0;

  for (let i = 0; i < fallbackChain.length; i++) {
    const currentModel = fallbackChain[i];
    try {
      const text = await getOpenRouterCompletion({
        model: currentModel,
        messages,
        temperature: options?.temperature,
        max_tokens: options?.max_tokens,
        signal: options?.signal,
        timeoutMs: options?.timeoutMs,
      });

      return { text, modelUsed: currentModel };
    } catch (err: any) {
      if (options?.signal?.aborted) {
        throw err; // Stop immediately if client aborted the stream
      }

      const isTimeout = 
        err.message?.toLowerCase().includes("timeout") || 
        err.message?.toLowerCase().includes("deadline") ||
        err.name === "TimeoutError";

      if (isTimeout) {
        timeoutCount++;
      }
      retryCount++;

      const nextModel = fallbackChain[i + 1] || "None";
      Logger.warn({
        action: "MODEL_FAILOVER_TRIGGERED",
        model: currentModel,
        metadata: {
          error: err.message || "Unknown error",
          nextModel,
          retryCount,
          timeoutCount,
        },
      });
    }
  }

  // If all models in the fallback chain are exhausted, raise localized non-technical failure copy
  throw new Error("Something felt briefly interrupted.");
}

export function getChatModel(): string[] {
  return getModelFallbackChain("CHAT_FAST");
}

export function getReflectionModel(): string[] {
  return getModelFallbackChain("REFLECTION_PREMIUM");
}

export function getSafetyModel(): string[] {
  return getModelFallbackChain("SAFETY_EVALUATOR");
}
