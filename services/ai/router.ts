import { getOpenRouterCompletion } from "./openrouter";
import { getGroqCompletion } from "./groq";
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
    onFallback?: () => void;
  }
): Promise<{ text: string; modelUsed: string }> {
  let retryCount = 0;
  let timeoutCount = 0;

  for (let i = 0; i < fallbackChain.length; i++) {
    const currentModel = fallbackChain[i];
    try {
      const isGroq = currentModel.startsWith("groq::");
      const modelId = isGroq ? currentModel.replace("groq::", "") : currentModel;

      const text = isGroq
        ? await getGroqCompletion({
            model: modelId,
            messages,
            temperature: options?.temperature,
            max_tokens: options?.max_tokens,
            signal: options?.signal,
          })
        : await getOpenRouterCompletion({
            model: currentModel,
            messages,
            temperature: options?.temperature,
            max_tokens: options?.max_tokens,
            signal: options?.signal,
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

      if (options?.onFallback) {
        options.onFallback();
      }
    }
  }

  // If all models in the fallback chain are exhausted, raise localized non-technical failure copy
  throw new Error("Something felt briefly interrupted.");
}

export function getChatModel(): string[] {
  return getModelFallbackChain("CHAT_PRIMARY");
}

export function getChillModel(): string[] {
  return getModelFallbackChain("CHAT_CHILL");
}

export function getReflectionModel(): string[] {
  return getModelFallbackChain("REFLECTION_PREMIUM");
}

export function getSafetyModel(): string[] {
  return getModelFallbackChain("SAFETY_EVALUATOR");
}

/** Fast single-model chain for preflight safety checks — no slow free-tier fallbacks. */
export function getSafetyQuickModel(): string[] {
  return getModelFallbackChain("SAFETY_QUICK");
}

export function getGroqChatModel(): string[] {
  return getModelFallbackChain("GROQ_CHAT");
}

export function getGroqChillModel(): string[] {
  return getModelFallbackChain("GROQ_CHILL");
}
