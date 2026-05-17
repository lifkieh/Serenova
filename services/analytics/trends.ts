import { getSupabase } from "@/lib/supabase";

export type SoftAnalytics = {
    totalJournals: number;
    topMoods: { mood: string; count: number }[];
    recentThemes: string[];
};

export async function getSoftAnalytics(userId: string): Promise<SoftAnalytics> {
    const supabase = getSupabase();
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [{ count: totalJournals }, { data: moods }, { data: themes }] = await Promise.all([
        supabase.from("journals").select("*", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("moods").select("mood").eq("user_id", userId).gte("created_at", thirtyDaysAgo.toISOString()),
        supabase.from("memory_context").select("theme").eq("user_id", userId).order("frequency", { ascending: false }).limit(5)
    ]);

    const moodCounts: Record<string, number> = {};
    if (moods) {
        for (const m of moods) {
            moodCounts[m.mood] = (moodCounts[m.mood] || 0) + 1;
        }
    }

    const topMoods = Object.entries(moodCounts)
        .map(([mood, count]) => ({ mood, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

    return {
        totalJournals: totalJournals || 0,
        topMoods,
        recentThemes: themes?.map(t => t.theme) || []
    };
}
