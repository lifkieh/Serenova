/**
 * Emotional pacing for SSE streaming.
 * Buffers tokens and flushes at punctuation boundaries
 * to avoid awkward mid-word/mid-sentence cutoffs.
 * Creates a calm, natural typing cadence.
 */

const PUNCTUATION_FLUSH = /[.!?,;:\n—–\-]/;

export function createPacedStream(
    sourceStream: AsyncIterable<{ choices: { delta: { content?: string | null } }[] }>,
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

/**
 * Paces a fully pre-generated and vetted text string as an SSE stream.
 * Employs serene, punctuation-aware breathing pauses for a calm cadence.
 */
export async function paceFullTextStream(
    fullText: string,
    controller: ReadableStreamDefaultController<Uint8Array>,
    onComplete: (completed: string) => void
) {
    const encoder = new TextEncoder();
    // Split text by words and whitespaces to preserve stream flow
    const chunks = fullText.split(/(\s+)/);

    try {
        for (const chunk of chunks) {
            if (!chunk) continue;
            
            // Send chunk formatted as valid SSE
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
            
            // Serene pacing delays
            let delay = 10;
            if (/[.!?,;:—–]/.test(chunk)) {
                delay = 140; // Restful pause at sentence boundaries
            } else if (/\n/.test(chunk)) {
                delay = 200; // Reflective pause at paragraphs
            }
            
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
        onComplete(fullText);
    } catch (err) {
        onComplete(fullText);
        throw err;
    }
}
