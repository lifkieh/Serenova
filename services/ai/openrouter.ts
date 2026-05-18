import OpenAI from "openai";

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
  timeoutMs?: number;
}

/**
 * Perform a chat completion via the centralized OpenRouter client.
 * Enforces native API timeouts and propagates abortion signals cleanly.
 */
export async function getOpenRouterCompletion(
  params: OpenRouterCompletionParams
): Promise<string> {
  const timeout = params.timeoutMs ?? 15000; // Default 15s timeout as per specifications

  try {
    const completion = await openRouterClient.chat.completions.create(
      {
        model: params.model,
        messages: params.messages as any,
        stream: false,
        temperature: params.temperature ?? 0.3,
        max_tokens: params.max_tokens,
      },
      {
        signal: params.signal,
        timeout,
      }
    );

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Received empty response from model provider.");
    }
    return content.trim();
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw error;
    }
    throw new Error(error.message || "Model request execution failed.");
  }
}
