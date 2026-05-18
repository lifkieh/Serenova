import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { getChatModel, withModelFallback } from "@/services/ai/router";

const lastDecayRun = new Map<string, number>();
const DECAY_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { allowed } = rateLimit(`memory:${userId}`, 10, 60_000);
        if (!allowed) {
            return NextResponse.json({ error: "Too many requests." }, { status: 429 });
        }

        const body = await req.json();
        const { messages } = body;

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        // Only run every 5 messages
        if (messages.length % 5 !== 0) {
            return NextResponse.json({ success: true, message: "Skipped" });
        }

        const recentMessages = messages.slice(-10).map((m: { role: string; content: string }) => m.content).join("\n");

        const prompt = `Extract recurring emotional themes from the following messages.
Rules:
- Extract ONLY emotional themes (e.g., "work stress", "loneliness", "anxiety at night").
- DO NOT extract specific names, places, or personal events.
- Return ONLY a valid JSON array of strings, max 5 themes. No markdown, no markdown backticks, no other text.

Messages:
${recentMessages}`;

        const { text: content } = await withModelFallback(
            getChatModel(),
            [{ role: "user", content: prompt }],
            {
                temperature: 0.1,
            }
        );

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

        const themesToInsert = themes.slice(0, 5).map(t => t.toLowerCase());

        if (themesToInsert.length > 0) {
            const supabase = getSupabase();
            
            const { data: existingRecords } = await supabase
                .from("memory_context")
                .select("id, theme, frequency")
                .eq("user_id", userId)
                .in("theme", themesToInsert);

            const existingMap = new Map((existingRecords || []).map(r => [r.theme, r]));
            const now = new Date().toISOString();

            const upsertPayload = themesToInsert.map(theme => {
                const existing = existingMap.get(theme);
                if (existing) {
                    return {
                        id: existing.id,
                        user_id: userId,
                        theme: existing.theme,
                        frequency: existing.frequency + 1,
                        last_seen: now
                    };
                } else {
                    return {
                        user_id: userId,
                        theme: theme,
                        frequency: 1,
                        last_seen: now
                    };
                }
            });

            await supabase
                .from("memory_context")
                .upsert(upsertPayload, { onConflict: "user_id, theme" });
        }

        // Run decay in background (non-blocking) with 1 hour rate limit
        const nowMs = Date.now();
        const lastRun = lastDecayRun.get(userId) || 0;
        
        if (nowMs - lastRun > DECAY_COOLDOWN_MS) {
            lastDecayRun.set(userId, nowMs);
            import("@/services/memory/decay")
                .then(({ runMemoryDecay }) => runMemoryDecay(userId))
                .catch(console.error);
        }

        return NextResponse.json({ success: true, themes });
    } catch (error) {
        console.error("Memory extraction error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
