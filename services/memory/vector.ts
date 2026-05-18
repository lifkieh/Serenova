import { GoogleGenerativeAI } from "@google/generative-ai";

export async function generateEmbedding(text: string): Promise<number[] | null> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.EMBEDDING_API_KEY;
    if (!apiKey) {
        return null;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const result = await model.embedContent(text);
        return result.embedding?.values || null;
    } catch (error) {
        console.error("Gemini embedding generation error:", error);

        // Fallback to OpenAI if EMBEDDING_API_KEY is configured
        if (process.env.EMBEDDING_API_KEY) {
            try {
                const res = await fetch("https://api.openai.com/v1/embeddings", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${process.env.EMBEDDING_API_KEY}`,
                    },
                    body: JSON.stringify({
                        model: "text-embedding-3-small",
                        input: text,
                    }),
                });

                if (res.ok) {
                    const json = await res.json();
                    return json.data?.[0]?.embedding || null;
                }
            } catch (fallbackError) {
                console.error("OpenAI embedding fallback error:", fallbackError);
            }
        }
        return null;
    }
}

/**
 * Store embedding for a memory theme.
 */
export async function storeEmbedding(memoryId: string, embedding: number[]) {
    const { getSupabase } = await import("@/lib/supabase");
    const supabase = getSupabase();

    try {
        await supabase
            .from("memory_context")
            .update({ embedding: JSON.stringify(embedding) })
            .eq("id", memoryId);
    } catch (error) {
        console.error("Store embedding error:", error);
    }
}
