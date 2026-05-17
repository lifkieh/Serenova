import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import OpenAI from "openai";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { userId, messages } = body;

        if (!userId || !messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        // Only run every 5 messages
        if (messages.length % 5 !== 0) {
            return NextResponse.json({ success: true, message: "Skipped" });
        }

        const recentMessages = messages.slice(-10).map((m: any) => m.content).join("\n");

        const client = new OpenAI({
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: process.env.OPENROUTER_API_KEY,
        });

        const prompt = `Extract recurring emotional themes from the following messages.
Rules:
- Extract ONLY emotional themes (e.g., "work stress", "loneliness", "anxiety at night").
- DO NOT extract specific names, places, or personal events.
- Return ONLY a valid JSON array of strings, max 5 themes. No markdown, no markdown backticks, no other text.

Messages:
${recentMessages}`;

        const completion = await client.chat.completions.create({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
        });

        const content = completion.choices[0].message.content?.trim() || "[]";
        
        let themes: string[] = [];
        try {
            themes = JSON.parse(content);
        } catch {
            // strip backticks if any
            try {
                themes = JSON.parse(content.replace(/^```json\n?/, "").replace(/\n?```$/, ""));
            } catch {
                themes = [];
            }
        }

        if (Array.isArray(themes) && themes.length > 0) {
            const supabase = getSupabase();
            
            for (const theme of themes.slice(0, 5)) {
                // Check if theme exists
                const { data: existing } = await supabase
                    .from("memory_context")
                    .select("id, frequency")
                    .eq("user_id", userId)
                    .ilike("theme", theme)
                    .single();
                
                if (existing) {
                    await supabase
                        .from("memory_context")
                        .update({ 
                            frequency: existing.frequency + 1,
                            last_seen: new Date().toISOString()
                        })
                        .eq("id", existing.id);
                } else {
                    await supabase
                        .from("memory_context")
                        .insert([{
                            user_id: userId,
                            theme: theme.toLowerCase(),
                            frequency: 1
                        }]);
                }
            }
        }
        // Run decay in background (non-blocking)
        import("@/services/memory/decay")
            .then(({ runMemoryDecay }) => runMemoryDecay(userId))
            .catch(console.error);

        return NextResponse.json({ success: true, themes });
    } catch (error) {
        console.error("Memory extraction error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
