/**
 * Emotional pacing for SSE streaming.
 *
 * Guarantees:
 * - Streams at natural phrase/sentence boundaries — never raw token fragments
 * - Emotional-state-aware delay profiles (drained / thoughtful / lighter / overwhelmed / default)
 * - Cold-start bridge: one soft line if first chunk is delayed beyond threshold
 * - streamClosed guard on every enqueue to prevent stale emissions
 */

// Sentence-boundary flush: period, exclamation, question, newline
const SENTENCE_BOUNDARY = /[.!?\n]/;
// Phrase-boundary flush: comma, semicolon, colon, em-dash, en-dash
const PHRASE_BOUNDARY = /[,;:—–]/;

export type EmotionalPacingState =
  | "drained"
  | "overwhelmed"
  | "thoughtful"
  | "lighter"
  | "default";

interface PacingDelays {
  sentence: number;   // ms pause after sentence end
  phrase: number;     // ms pause after phrase boundary
  word: number;       // ms pause between normal words
  maxChunkLen: number; // max chars before forced flush
}

const PACING_PROFILES: Record<EmotionalPacingState, PacingDelays> = {
  drained: {
    sentence: 200,
    phrase: 120,
    word: 8,
    maxChunkLen: 30,
  },
  overwhelmed: {
    sentence: 160,
    phrase: 90,
    word: 5,
    maxChunkLen: 35,
  },
  thoughtful: {
    sentence: 150,
    phrase: 80,
    word: 3,
    maxChunkLen: 50,
  },
  lighter: {
    sentence: 80,
    phrase: 40,
    word: 1,
    maxChunkLen: 60,
  },
  default: {
    sentence: 120,
    phrase: 60,
    word: 1,
    maxChunkLen: 50,
  },
};

/**
 * Paces a fully-generated text string as an SSE stream.
 *
 * @param fullText        - Vetted assistant response text
 * @param controller      - ReadableStream enqueue controller
 * @param onComplete      - Callback after all text has been sent
 * @param streamClosed    - Shared ref box { value: boolean } to prevent stale enqueues
 * @param abortSignal     - Linked abort signal for early exit
 * @param emotionalState  - Current user mood for pacing profile selection
 * @param lang            - UI language for cold-start bridge copy
 */
export async function paceFullTextStream(
  fullText: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  onComplete: (completed: string) => void,
  streamClosed: { value: boolean },
  abortSignal?: AbortSignal,
  emotionalState: EmotionalPacingState = "default",
  lang: "en" | "id" = "en"
) {
  const encoder = new TextEncoder();
  const profile = PACING_PROFILES[emotionalState];

  function safeEnqueue(payload: string) {
    if (streamClosed.value) return;
    if (abortSignal?.aborted) return;
    try {
      controller.enqueue(encoder.encode(payload));
    } catch {
      // stream was closed externally
    }
  }

  // Buffer incoming text, flushing at natural boundaries
  let buffer = "";
  let coldStartBridgeSent = false;
  let charsSent = 0;
  const COLD_START_THRESHOLD = 80; // chars before we consider bridge relevant

  function flushBuffer() {
    if (!buffer) return;
    safeEnqueue(`data: ${JSON.stringify({ content: buffer })}\n\n`);
    charsSent += buffer.length;
    buffer = "";
  }

  // Inject cold-start bridge once if the first chunk is large
  // (indicates model returned a full response without incremental streaming)
  function injectBridgeIfNeeded() {
    if (coldStartBridgeSent || charsSent > 0) return;
    if (fullText.length > COLD_START_THRESHOLD) {
      const bridge = lang === "id"
        ? "aku lagi nyusun kata-katanya pelan-pelan."
        : "trying to put this into words carefully.";
      safeEnqueue(`data: ${JSON.stringify({ indicator: bridge })}\n\n`);
      coldStartBridgeSent = true;
    }
  }

  try {
    injectBridgeIfNeeded();

    // Split into words preserving whitespace separators
    const tokens = fullText.split(/(\s+)/);

    for (const token of tokens) {
      if (streamClosed.value || abortSignal?.aborted) break;
      if (!token) continue;

      buffer += token;

      const isSentenceEnd = SENTENCE_BOUNDARY.test(token);
      const isPhraseEnd   = PHRASE_BOUNDARY.test(token);
      const isOversize    = buffer.length >= profile.maxChunkLen;

      if (isSentenceEnd || isOversize || isPhraseEnd) {
        flushBuffer();
        const delay = isSentenceEnd ? profile.sentence
          : isPhraseEnd ? profile.phrase
          : profile.word;

        if (delay > 0 && !streamClosed.value && !abortSignal?.aborted) {
          await new Promise<void>((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // Flush any trailing content
    flushBuffer();
    onComplete(fullText);
  } catch (err) {
    flushBuffer();
    onComplete(fullText);
    throw err;
  }
}

/**
 * Legacy createPacedStream — kept for any callers that consume a live OpenAI stream.
 * Guards enqueue with streamClosed ref box.
 */
export function createPacedStream(
  sourceStream: AsyncIterable<{ choices: { delta: { content?: string | null } }[] }>,
  controller: ReadableStreamDefaultController<Uint8Array>,
  onComplete: (fullResponse: string) => void,
  streamClosed?: { value: boolean }
) {
  const encoder = new TextEncoder();
  let fullResponse = "";
  let buffer = "";

  function flush() {
    if (!buffer) return;
    if (streamClosed?.value) return;
    try {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: buffer })}\n\n`));
    } catch {}
    fullResponse += buffer;
    buffer = "";
  }

  return (async () => {
    try {
      for await (const chunk of sourceStream) {
        if (streamClosed?.value) break;
        const content = chunk.choices[0]?.delta?.content || "";
        if (!content) continue;

        buffer += content;

        if (/[.!?\n]/.test(content) && buffer.length >= 3) {
          flush();
        } else if (buffer.length > 50) {
          flush();
        }
      }
      flush();
      onComplete(fullResponse);
    } catch (err) {
      flush();
      onComplete(fullResponse);
      throw err;
    }
  })();
}
