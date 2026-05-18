import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { getChatModel, withModelFallback } from "@/services/ai/router";
import { sanitizeForPrompt } from "@/lib/sanitize";

export async function POST(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return NextResponse.json({ success: true, message: "Guest mode" });

        const body = await req.json();
        const { message, conversationId } = body;

        if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });

        const prompt = `Analyze the emotional tone of the following message and return exactly one mood tag from this list:
[calm, tired, overwhelmed, anxious, lonely, hopeful, numb, frustrated, grateful].
If none perfectly fit, pick the closest one. Return ONLY the single word, nothing else.

Message: "${sanitizeForPrompt(message)}"`;

        const { text } = await withModelFallback(
            getChatModel(),
            [{ role: "user", content: prompt }],
            {
                temperature: 0.1,
            }
        );

        const detectedMood = text.trim().toLowerCase();
        const validMoods = ['calm', 'tired', 'overwhelmed', 'anxious', 'lonely', 'hopeful', 'numb', 'frustrated', 'grateful'];
        
        if (detectedMood && validMoods.includes(detectedMood)) {
            const supabase = getSupabase();
            await supabase.from("moods").insert([{ 
                user_id: userId, 
                mood: detectedMood, 
                source: "ai_detected",
                conversation_id: conversationId 
            }]);
        }

        return NextResponse.json({ success: true, mood: detectedMood });
    } catch (error) {
        console.error("Mood detection error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
