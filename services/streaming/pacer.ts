/**
 * Emotional pacing for SSE streaming.
 * Buffers tokens and flushes at punctuation boundaries
 * to avoid awkward mid-word/mid-sentence cutoffs.
 * Creates a calm, natural typing cadence.
 */

const PUNCTUATION_FLUSH = /[.!?,;:\n—–\-]/;
const SENTENCE_END = /[.!?]\s*$/;

export function createPacedStream(
    sourceStream: AsyncIterable<any>,
    controller: ReadableStreamDefaultController<Uint8Array>,
    onComplete: (fullResponse: string) => void
) {
    const encoder = new TextEncoder();
    let fullResponse = "";
    let buffer = "";

    function flush() {
        if (buffer) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: buffer })}\n\n`));
            fullResponse += buffer;
            buffer = "";
        }
    }

    return (async () => {
        try {
            for await (const chunk of sourceStream) {
                const content = chunk.choices[0]?.delta?.content || "";
                if (!content) continue;

                buffer += content;

                // Flush at natural punctuation boundaries for calm pacing
                if (PUNCTUATION_FLUSH.test(content) && buffer.length >= 3) {
                    flush();
                }

                // Also flush if buffer gets too large (avoid stalling)
                if (buffer.length > 40) {
                    flush();
                }
            }

            // Flush remaining buffer
            flush();
            onComplete(fullResponse);
        } catch (err) {
            // Flush what we have before erroring
            flush();
            onComplete(fullResponse);
            throw err;
        }
    })();
}
