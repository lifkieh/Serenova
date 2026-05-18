import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";

const ALLOWED_FEEDBACK_TYPES = [
    "grounding",
    "too_generic",
    "too_much",
    "emotionally_missed",
    "comforting",
    "awkward",
    "repetitive"
];

export async function POST(req: Request) {
    try {
        const userId = await getUserId();
        const body = await req.json();
        const { feedbackType, optionalText, conversationId, messageId } = body;

        // Validation
        if (!feedbackType || !conversationId || !messageId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        if (!ALLOWED_FEEDBACK_TYPES.includes(feedbackType)) {
            return NextResponse.json({ error: "Invalid feedback type" }, { status: 400 });
        }

        const supabase = getSupabase();
        
        // Save feedback
        const { data, error } = await supabase
            .from("response_feedback")
            .insert([
                {
                    feedback_type: feedbackType,
                    optional_text: optionalText || null,
                    conversation_id: conversationId,
                    message_id: messageId
                }
            ])
            .select()
            .single();

        if (error) {
            console.error("Supabase feedback insert error:", error);
            throw error;
        }

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error("Feedback aggregation error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
