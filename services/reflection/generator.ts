import { getSupabase } from "@/lib/supabase";
import OpenAI from "openai";

export async function generateWeeklyReflection(userId: string) {
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

    const client = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
    });

    const prompt = `You are generating a weekly emotional reflection for the user.
Tone: Reflective, emotionally mature, calm, grounded.
NEVER: use a motivational coach tone, therapist tone, diagnosis, or exaggerated praise.
Goal: Provide a short 2-3 sentence reflection on how their week felt based on the data.

Data:
${summaryContext}
`;

    const completion = await client.chat.completions.create({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
    });

    const reflectionContent = completion.choices[0].message.content?.trim();

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
}

export async function generateMonthlyReflection(userId: string) {
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

    const client = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
    });

    const prompt = `You are generating a monthly emotional reflection.
Tone: Reflective, emotionally mature, calm, grounded. Like a quiet observation.
NEVER: motivational coach, therapist, diagnosis, exaggerated praise, "you improved!"
Goal: 3-4 sentences capturing how this month felt emotionally. Note shifts, recurring weight, lighter moments.

Data:
${summaryContext}
`;

    const completion = await client.chat.completions.create({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
    });

    const reflectionContent = completion.choices[0].message.content?.trim();

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
}
