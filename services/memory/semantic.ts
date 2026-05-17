import { getSupabase } from "@/lib/supabase";

/**
 * Semantic memory search via pgvector cosine similarity.
 * Falls back gracefully if embeddings aren't populated yet.
 */
export async function semanticSearch(
    userId: string,
    queryEmbedding: number[],
    limit: number = 3
): Promise<{ theme: string; similarity: number }[]> {
    const supabase = getSupabase();

    try {
        // pgvector cosine similarity via RPC
        const { data, error } = await supabase.rpc("match_memories", {
            query_embedding: JSON.stringify(queryEmbedding),
            match_user_id: userId,
            match_count: limit,
        });

        if (error) {
            console.error("Semantic search RPC error:", error);
            return [];
        }

        return (data || []).map((d: any) => ({
            theme: d.theme,
            similarity: d.similarity,
        }));
    } catch (error) {
        console.error("Semantic search error:", error);
        return [];
    }
}

/**
 * Layered memory orchestration.
 * Blends SQL-ranked retrieval with semantic similarity when available.
 * 
 * Layers:
 * - SHORT TERM: recent messages (handled by chat history, not this function)
 * - MID TERM: SQL-ranked emotional themes (services/memory/retrieve.ts)
 * - LONG TERM: pgvector semantic embeddings (this function)
 * - EPHEMERAL: temporary states handled by decay service
 */
export async function getLayeredMemory(
    userId: string,
    currentMood?: string,
    queryText?: string
): Promise<string> {
    // Layer 1: SQL-ranked contextual retrieval (always available)
    const { getContextualMemory } = await import("@/services/memory/retrieve");
    const sqlContext = await getContextualMemory(userId, currentMood);

    // Layer 2: Semantic retrieval (when embeddings are available)
    let semanticContext = "";
    if (queryText && process.env.EMBEDDING_API_KEY) {
        try {
            const { generateEmbedding } = await import("@/services/memory/vector");
            const embedding = await generateEmbedding(queryText);

            if (embedding) {
                const results = await semanticSearch(userId, embedding, 2);
                if (results.length > 0) {
                    const semanticThemes = results.map(r => r.theme).join(", ");
                    semanticContext = `\nEmotionally similar past themes: ${semanticThemes}.`;
                }
            }
        } catch {
            // Semantic layer not ready yet — skip silently
        }
    }

    // Combine layers
    if (sqlContext && semanticContext) {
        return sqlContext + semanticContext;
    }
    return sqlContext || semanticContext;
}
