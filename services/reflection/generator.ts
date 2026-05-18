import { getSupabase } from "@/lib/supabase";
import { withModelFallback, getReflectionModel } from "../ai/router";
import { WEEKLY_REFLECTION_QUALITY_CONFIG, MONTHLY_REFLECTION_QUALITY_CONFIG } from "../reflections/config";
import { Logger } from "../logging/logger";

export async function generateWeeklyReflection(userId: string): Promise<string | null> {
    const supabase = getSupabase();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Fetch journals
    const { data: journals } = await supabase
        .from("journals")
        .select("title, content, mood_tag, created_at")
        .eq("user_id", userId)
        .gte("created_at", sevenDaysAgo.toISOString());

    // Fetch moods
    const { data: moods } = await supabase
        .from("moods")
        .select("mood, created_at")
        .eq("user_id", userId)
        .gte("created_at", sevenDaysAgo.toISOString());

    // Fetch memory themes
    const { data: memories } = await supabase
        .from("memory_context")
        .select("theme")
        .eq("user_id", userId)
        .gte("last_seen", sevenDaysAgo.toISOString());

    if (!journals?.length && !moods?.length) return null;

    const summaryContext = `
Journals:
${journals?.map(j => `- [${j.mood_tag || 'none'}] ${j.title || ''}: ${j.content.slice(0, 100)}...`).join('\n')}

Moods logged:
${moods?.map(m => m.mood).join(', ')}

Recent themes discussed:
${memories?.map(m => m.theme).join(', ')}
`;

    const prompt = `You are a quiet, late-night thoughtful emotional journaling companion.
Read the user's journals and moods from the past week.
Goal: Provide a warm, calm, and deeply grounded emotional reflection of about 3-4 sentences.

Guidelines:
1. EMOTIONAL PATTERN RECOGNITION: Notice recurring atmospheres, subtle pacing shifts, emotional contradictions, or withdrawal patterns (e.g., "there were moments where things sounded heavier underneath the surface", "it feels like the quietness of the weekend gave you a bit of space").
2. RECENCY WEIGHTING: Give more weight to the emotional state of the most recent entries rather than averaging out the whole week.
3. NATURAL STRUCTURAL VARIATION: Avoid template/repetitive endings. Do NOT use phrases like: "maybe that's okay", "and that's alright", "you've been carrying a lot", or "it's okay to feel this way". Vary your sentence structures naturally.
4. STRICTLY AVOID:
  * Therapist tone or clinical/diagnostic phrasing (do not say "Your coping mechanism", "depression", "anxiety", "clinical validation").
  * Productivity/coaching jargon (do not say "You are making progress!", "Keep it up!", "Success", "Goal-oriented tracking").
  * Exaggerated, robotic reassurance ("I am always here for you", "You are so strong").
  * Motivational clichés ("Tetap semangat!", "Kamu pasti bisa!").
  * Preachy or 'healing journey' style wording (do not say 'You are growing stronger every day', 'This indicates anxiety', 'You should practice coping strategies').
  * Labeling or diagnosing (do not say "you are healing from emotional trauma").

Data for the week (latest entries appear last):
${summaryContext}
`;

    try {
        const { text: reflectionContent, modelUsed } = await withModelFallback(
            getReflectionModel(),
            [{ role: "user", content: prompt }],
            {
                temperature: WEEKLY_REFLECTION_QUALITY_CONFIG.temperature,
                max_tokens: WEEKLY_REFLECTION_QUALITY_CONFIG.maxTokens,
            }
        );

        if (reflectionContent) {
            await supabase.from("reflections").insert([{
                user_id: userId,
                type: "weekly",
                period_start: sevenDaysAgo.toISOString(),
                period_end: new Date().toISOString(),
                content: reflectionContent
            }]);
        }

        return reflectionContent;
    } catch (err: any) {
        Logger.error({
            action: "WEEKLY_REFLECTION_GENERATION_FAILED",
            userId,
            error: err.message,
        });
        return null;
    }
}

export async function generateMonthlyReflection(userId: string): Promise<string | null> {
    const supabase = getSupabase();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: journals } = await supabase
        .from("journals")
        .select("title, content, mood_tag, created_at")
        .eq("user_id", userId)
        .gte("created_at", thirtyDaysAgo.toISOString());

    const { data: moods } = await supabase
        .from("moods")
        .select("mood, created_at")
        .eq("user_id", userId)
        .gte("created_at", thirtyDaysAgo.toISOString());

    const { data: memories } = await supabase
        .from("memory_context")
        .select("theme, frequency")
        .eq("user_id", userId)
        .order("frequency", { ascending: false })
        .limit(8);

    const { data: weeklyReflections } = await supabase
        .from("reflections")
        .select("content")
        .eq("user_id", userId)
        .eq("type", "weekly")
        .gte("created_at", thirtyDaysAgo.toISOString());

    if (!journals?.length && !moods?.length) return null;

    const summaryContext = `
Journals (${journals?.length || 0} entries):
${journals?.map(j => `- [${j.mood_tag || 'none'}] ${j.title || ''}: ${j.content.slice(0, 80)}...`).join('\n')}

Moods logged: ${moods?.map(m => m.mood).join(', ')}

Recurring themes: ${memories?.map(m => `${m.theme} (×${m.frequency})`).join(', ')}

Weekly reflections this month:
${weeklyReflections?.map(r => `- ${r.content}`).join('\n')}
`;

    const prompt = `You are a quiet, late-night thoughtful emotional journaling companion.
Read the user's monthly entries, moods, themes, and weekly checkpoint summaries.
Goal: Provide a profound, warm, and deeply grounded emotional reflection (about 4-5 sentences).

Guidelines:
1. EMOTIONAL PATTERN RECOGNITION: Capture the emotional rhythm of the past month. Notice quiet shifts, contradictions, recurring weights, lighter moments, or withdrawal patterns. Focus on the emotional atmosphere gently.
2. RECENCY WEIGHTING: Trace the arc of the month, but weight the emotional gravity of the most recent entries more heavily. Avoid averaging out the user's emotional state.
3. NATURAL STRUCTURAL VARIATION: Ensure your response does not feel like an AI template. Avoid formulaic endings such as "maybe that's okay", "and that's alright", "you've been carrying a lot", or "it is completely valid".
4. STRICTLY AVOID:
  * Therapist tone or clinical/diagnostic phrasing (do not say "Your coping mechanism", "depression", "anxiety", "clinical validation").
  * Productivity/coaching jargon (do not say "You are making progress!", "Keep it up!", "Success", "Goal-oriented tracking").
  * Exaggerated, robotic reassurance ("I am always here for you", "You are so strong").
  * Motivational clichés ("Tetap semangat!", "Kamu pasti bisa!").
  * Preachy or 'healing journey' style wording (do not say 'You are growing stronger every day', 'This indicates anxiety', 'You should practice coping strategies').
  * Advice overload or dictating feelings (do not say "you are healing from trauma").

Data for the month (latest entries appear last):
${summaryContext}
`;

    try {
        const { text: reflectionContent, modelUsed } = await withModelFallback(
            getReflectionModel(),
            [{ role: "user", content: prompt }],
            {
                temperature: MONTHLY_REFLECTION_QUALITY_CONFIG.temperature,
                max_tokens: MONTHLY_REFLECTION_QUALITY_CONFIG.maxTokens,
            }
        );

        if (reflectionContent) {
            await supabase.from("reflections").insert([{
                user_id: userId,
                type: "monthly",
                period_start: thirtyDaysAgo.toISOString(),
                period_end: new Date().toISOString(),
                content: reflectionContent
            }]);
        }

        return reflectionContent;
    } catch (err: any) {
        Logger.error({
            action: "MONTHLY_REFLECTION_GENERATION_FAILED",
            userId,
            error: err.message,
        });
        return null;
    }
}
