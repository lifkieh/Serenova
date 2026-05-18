import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { Logger } from "@/services/logging/logger";

/**
 * GET /api/conversations
 * Supports:
 * 1. Default (no query): List all active (non-deleted) conversations.
 * 2. ?id=CONVERSATION_ID: Retrieve last 30 messages for a specific conversation.
 * 3. ?recent=true: Retrieve most recent conversation's messages (original behavior).
 */
export async function GET(req: Request) {
  const requestId = Logger.generateRequestId();
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ conversations: [], messages: [] });
  }

  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("id");
  const recent = searchParams.get("recent") === "true" || (!conversationId && searchParams.size === 0);

  const supabase = getSupabase();

  try {
    // Case 1: Specific or Recent Conversation Messages
    if (conversationId || recent) {
      let activeConversationId = conversationId;

      if (recent) {
        // Fetch most recent active conversation (not soft deleted)
        const { data: conversation, error: convError } = await supabase
          .from("conversations")
          .select("id, title")
          .eq("user_id", userId)
          .not("title", "like", "[DELETED]%")
          .order("updated_at", { ascending: false })
          .limit(1);

        if (convError) throw convError;
        
        if (!conversation || conversation.length === 0) {
          return NextResponse.json({ conversationId: null, messages: [] });
        }
        activeConversationId = conversation[0].id;
      }

      if (!activeConversationId) {
        return NextResponse.json({ conversationId: null, messages: [] });
      }

      // Fetch last 30 messages from this conversation
      const { data: messages, error: msgError } = await supabase
        .from("messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", activeConversationId)
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(30);

      if (msgError) throw msgError;

      return NextResponse.json({
        conversationId: activeConversationId,
        messages: messages ?? [],
      });
    }

    // Case 2: List all conversations (excluding [DELETED])
    const { data: conversations, error: listError } = await supabase
      .from("conversations")
      .select("id, title, created_at, updated_at")
      .eq("user_id", userId)
      .not("title", "like", "[DELETED]%")
      .order("updated_at", { ascending: false });

    if (listError) throw listError;

    // Parse statuses from titles
    const parsedConversations = (conversations ?? []).map((c) => {
      const titleStr = c.title || "New Conversation";
      const isArchived = titleStr.startsWith("[ARCHIVED] ");
      const cleanTitle = isArchived ? titleStr.replace("[ARCHIVED] ", "") : titleStr;

      return {
        id: c.id,
        title: cleanTitle,
        isArchived,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      };
    });

    return NextResponse.json({
      conversations: parsedConversations,
    });
  } catch (error: any) {
    Logger.error({
      requestId,
      userId,
      action: "GET_CONVERSATIONS_ERROR",
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: "Failed to retrieve conversations" },
      { status: 500 }
    );
  }
}
