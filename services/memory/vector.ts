/**
 * Generate embeddings for emotional themes using a lightweight model.
 * Returns a 768-dimension vector.
 * 
 * NOTE: OpenRouter doesn't support embeddings natively.
 * This uses a direct embedding endpoint — swap to your preferred provider.
 * For now, this is a preparation layer that returns null if unavailable.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
    // Guard: if no embedding key is configured, skip gracefully
    if (!process.env.EMBEDDING_API_KEY) {
        return null;
    }

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

        if (!res.ok) {
            console.error("Embedding API error:", res.status);
            return null;
        }

        const json = await res.json();
        return json.data?.[0]?.embedding || null;
    } catch (error) {
        console.error("Embedding generation error:", error);
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
