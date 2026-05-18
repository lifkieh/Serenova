import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ messages: [] });

  const supabase = getSupabase();

  // Get most recent conversation
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (!conversation) return NextResponse.json({ messages: [] });

  // Get last 30 messages from that conversation
  const { data: messages } = await supabase
    .from("messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .limit(30);

  return NextResponse.json({
    conversationId: conversation.id,
    messages: messages ?? []
  });
}
