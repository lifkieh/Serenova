import OpenAI from "openai";
import { getModelTimeouts } from "./models";

let groqClient: OpenAI | null = null;

function getGroqClient(): OpenAI {
  if (!groqClient) {
    groqClient = new OpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY || "",
      dangerouslyAllowBrowser: false,
    });
  }
  return groqClient;
}

export interface GroqCompletionParams {
  model: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  temperature?: number;
  max_tokens?: number;
  signal?: AbortSignal;
}

export async function getGroqCompletion(
  params: GroqCompletionParams
): Promise<string> {
  const timeouts = getModelTimeouts(params.model);
  const startTime = Date.now();

  console.log(`[CHAT] STREAM_CONNECTED - model: ${params.model} (groq)`);

  const internalController = new AbortController();
  let receivedFirstChunk = false;
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

  timeoutTimer = setTimeout(() => {
    if (!receivedFirstChunk) triggerTimeout("CONNECTION_TIMEOUT");
  }, timeouts.firstChunkTimeoutMs);

  try {
    const client = getGroqClient();
    const stream = await client.chat.completions.create(
      {
        model: params.model,
        messages: params.messages as any,
        stream: true,
        temperature: params.temperature ?? 0.3,
        max_tokens: params.max_tokens,
      },
      { signal: internalController.signal }
    );

    for await (const chunk of stream) {
      if (isAborted) throw new Error(abortReason || "PROVIDER_ABORT");

      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        if (!receivedFirstChunk) {
          receivedFirstChunk = true;
          console.log(`[CHAT] FIRST_CHUNK_RECEIVED - model: ${params.model} (groq), ttft: ${Date.now() - startTime}ms`);
        }
        if (timeoutTimer) clearTimeout(timeoutTimer);
        timeoutTimer = setTimeout(() => triggerTimeout("IDLE_TIMEOUT"), timeouts.idleTimeoutMs);
        fullText += content;
      }
    }

    if (isAborted) throw new Error(abortReason || "PROVIDER_ABORT");
    if (timeoutTimer) clearTimeout(timeoutTimer);
    if (!fullText.trim()) throw new Error("Received empty response from model provider.");

    console.log(`[CHAT] STREAM_FINISHED - model: ${params.model} (groq), duration: ${Date.now() - startTime}ms`);
    return fullText.trim();
  } catch (error: any) {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    const finalReason = (abortReason || (error.name === "AbortError" ? "USER_CANCELLED" : "PROVIDER_ABORT")) as string;

    if (finalReason === "CONNECTION_TIMEOUT") {
      console.warn(`[CHAT] STREAM_CONNECTION_TIMEOUT - model: ${params.model} (groq)`);
      throw new Error("CONNECTION_TIMEOUT");
    }
    if (finalReason === "IDLE_TIMEOUT") {
      console.warn(`[CHAT] STREAM_IDLE_TIMEOUT - model: ${params.model} (groq)`);
      throw new Error("IDLE_TIMEOUT");
    }
    if (finalReason === "USER_CANCELLED") {
      console.info(`[CHAT] STREAM_ABORTED - model: ${params.model} (groq, user cancelled)`);
      throw new Error("USER_CANCELLED");
    }
    throw new Error(error.message || "Groq request failed.");
  }
}
