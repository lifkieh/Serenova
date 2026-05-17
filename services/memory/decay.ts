import { getSupabase } from "@/lib/supabase";

/**
 * Run memory decay for a user.
 * - Temporary emotional states (low frequency, old) get deactivated.
 * - Recurring themes stay alive.
 * - Duplicate/near-duplicate themes get collapsed.
 */
export async function runMemoryDecay(userId: string) {
    const supabase = getSupabase();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    try {
        // Phase 1: Deactivate old, low-frequency themes (temporary emotional states)
        await supabase
            .from("memory_context")
            .update({ is_active: false })
            .eq("user_id", userId)
            .eq("is_active", true)
            .lt("last_seen", thirtyDaysAgo.toISOString())
            .lt("frequency", 3);

        // Phase 2: Deactivate very old themes even if medium frequency
        await supabase
            .from("memory_context")
            .update({ is_active: false })
            .eq("user_id", userId)
            .eq("is_active", true)
            .lt("last_seen", sixtyDaysAgo.toISOString())
            .lt("frequency", 6);

        // Phase 3: Collapse duplicate themes
        const { data: allActive } = await supabase
            .from("memory_context")
            .select("id, theme, frequency")
            .eq("user_id", userId)
            .eq("is_active", true)
            .order("frequency", { ascending: false });

        if (allActive && allActive.length > 1) {
            const seen = new Map<string, string>(); // normalized -> surviving id
            const toDeactivate: string[] = [];

            for (const mem of allActive) {
                const normalized = mem.theme.toLowerCase().trim();
                if (seen.has(normalized)) {
                    toDeactivate.push(mem.id);
                } else {
                    seen.set(normalized, mem.id);
                }
            }

            if (toDeactivate.length > 0) {
                await supabase
                    .from("memory_context")
                    .update({ is_active: false })
                    .in("id", toDeactivate);
            }
        }
    } catch (error) {
        console.error("Memory decay error:", error);
    }
}
