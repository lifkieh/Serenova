import OpenAI from "openai";
import { getModelTimeouts } from "./models";

// Initialize centralized OpenRouter client with safe defaults
const baseURL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
const apiKey = process.env.OPENROUTER_API_KEY || "";

export const openRouterClient = new OpenAI({
  baseURL,
  apiKey,
  dangerouslyAllowBrowser: false,
});

export interface OpenRouterCompletionParams {
  model: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  temperature?: number;
  max_tokens?: number;
  signal?: AbortSignal;
}

/**
 * Perform a chat completion via the centralized OpenRouter client.
 * Enforces dynamic connection and stream idle timeouts, streaming chunks
 * internally to accumulate the complete string while providing observability.
 * Uses a linked AbortController to guarantee instant network termination on timeout.
 */
export async function getOpenRouterCompletion(
  params: OpenRouterCompletionParams
): Promise<string> {
  const timeouts = getModelTimeouts(params.model);
  const startTime = Date.now();
  
  console.log(`[CHAT] STREAM_CONNECTED - model: ${params.model}`);

  const internalController = new AbortController();
  let receivedFirstChunk = false;
  let timeToFirstToken = 0;
  let fullText = "";
  let timeoutTimer: NodeJS.Timeout | null = null;
  let isAborted = false;
  let abortReason: "CONNECTION_TIMEOUT" | "IDLE_TIMEOUT" | "USER_CANCELLED" | "PROVIDER_ABORT" | null = null;

  const triggerTimeout = (reason: "CONNECTION_TIMEOUT" | "IDLE_TIMEOUT") => {
    isAborted = true;
    abortReason = reason;
    internalController.abort();
    if (timeoutTimer) clearTimeout(timeoutTimer);
  };

  // Link client abort signal to our internal controller
  if (params.signal) {
    if (params.signal.aborted) {
      isAborted = true;
      abortReason = "USER_CANCELLED";
      internalController.abort();
    } else {
      params.signal.addEventListener("abort", () => {
        isAborted = true;
        abortReason = "USER_CANCELLED";
        internalController.abort();
        if (timeoutTimer) clearTimeout(timeoutTimer);
      });
    }
  }

  // Phase A: Set Connection Timeout (waiting for first chunk)
  timeoutTimer = setTimeout(() => {
    if (!receivedFirstChunk) {
      triggerTimeout("CONNECTION_TIMEOUT");
    }
  }, timeouts.firstChunkTimeoutMs);

  try {
    const stream = await openRouterClient.chat.completions.create(
      {
        model: params.model,
        messages: params.messages as any,
        stream: true,
        temperature: params.temperature ?? 0.3,
        max_tokens: params.max_tokens,
      },
      {
        signal: internalController.signal,
      }
    );

    for await (const chunk of stream) {
      if (isAborted) {
        throw new Error(abortReason || "PROVIDER_ABORT");
      }

      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        if (!receivedFirstChunk) {
          receivedFirstChunk = true;
          timeToFirstToken = Date.now() - startTime;
          console.log(`[CHAT] FIRST_CHUNK_RECEIVED - model: ${params.model}, time-to-first-token: ${timeToFirstToken}ms`);
        }

        // Phase B: Clear Connection Timeout and set Stream Idle Timeout
        if (timeoutTimer) clearTimeout(timeoutTimer);
        timeoutTimer = setTimeout(() => {
          triggerTimeout("IDLE_TIMEOUT");
        }, timeouts.idleTimeoutMs);

        fullText += content;
      }
    }

    if (isAborted) {
      throw new Error(abortReason || "PROVIDER_ABORT");
    }

    if (timeoutTimer) clearTimeout(timeoutTimer);

    if (!fullText.trim()) {
      throw new Error("Received empty response from model provider.");
    }

    const totalDuration = Date.now() - startTime;
    console.log(`[CHAT] STREAM_FINISHED - model: ${params.model}, total duration: ${totalDuration}ms`);

    return fullText.trim();
  } catch (error: any) {
    if (timeoutTimer) clearTimeout(timeoutTimer);

    const finalReason: string = abortReason || (error.name === "AbortError" ? "USER_CANCELLED" : "PROVIDER_ABORT");
    
    if (finalReason === "CONNECTION_TIMEOUT") {
      console.warn(`[CHAT] STREAM_CONNECTION_TIMEOUT - model: ${params.model}`);
      throw new Error("CONNECTION_TIMEOUT");
    }
    if (finalReason === "IDLE_TIMEOUT") {
      console.warn(`[CHAT] STREAM_IDLE_TIMEOUT - model: ${params.model}`);
      throw new Error("IDLE_TIMEOUT");
    }
    if (finalReason === "USER_CANCELLED") {
      console.info(`[CHAT] STREAM_ABORTED - model: ${params.model} (user cancelled)`);
      throw new Error("USER_CANCELLED");
    }

    throw new Error(error.message || "Model request execution failed.");
  }
}
