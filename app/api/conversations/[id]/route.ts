import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { Logger } from "@/services/logging/logger";

/**
 * PATCH /api/conversations/[id]
 * Renames or archives/unarchives a conversation.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = Logger.generateRequestId();
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabase();

  try {
    const body = await req.json();
    const { title, archived } = body;

    // 1. Fetch current conversation to understand its state
    const { data: conversation, error: fetchError } = await supabase
      .from("conversations")
      .select("title")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (fetchError || !conversation) {
      Logger.error({
        requestId,
        userId,
        action: "PATCH_CONVERSATION_FAILED",
        error: "Conversation not found or access denied",
        metadata: { conversationId: id },
      });
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    let currentTitle = conversation.title || "New Conversation";
    let isArchived = currentTitle.startsWith("[ARCHIVED] ");
    let isDeleted = currentTitle.startsWith("[DELETED] ");

    // Clean current title of system prefixes
    let cleanTitle = currentTitle;
    if (isArchived) cleanTitle = currentTitle.replace("[ARCHIVED] ", "");
    if (isDeleted) cleanTitle = currentTitle.replace("[DELETED] ", "");

    // Process rename
    if (typeof title === "string") {
      cleanTitle = title.trim();
    }

    // Process archive toggle
    if (typeof archived === "boolean") {
      isArchived = archived;
    }

    // Reconstruct full title based on states
    let finalTitle = cleanTitle;
    if (isArchived) {
      finalTitle = `[ARCHIVED] ${cleanTitle}`;
    }

    // Update conversation
    const { error: updateError } = await supabase
      .from("conversations")
      .update({
        title: finalTitle,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId);

    if (updateError) {
      throw updateError;
    }

    Logger.info({
      requestId,
      userId,
      action: "PATCH_CONVERSATION_SUCCESS",
      metadata: { conversationId: id, title: cleanTitle, isArchived },
    });

    return NextResponse.json({
      success: true,
      data: {
        id,
        title: cleanTitle,
        isArchived,
      },
    });
  } catch (error: any) {
    Logger.error({
      requestId,
      userId,
      action: "PATCH_CONVERSATION_ERROR",
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.json({ error: "Failed to update conversation" }, { status: 500 });
  }
}

/**
 * DELETE /api/conversations/[id]
 * Soft deletes a conversation by prepending "[DELETED] ".
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = Logger.generateRequestId();
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabase();

  try {
    // 1. Fetch current conversation to understand its state
    const { data: conversation, error: fetchError } = await supabase
      .from("conversations")
      .select("title")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (fetchError || !conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const currentTitle = conversation.title || "New Conversation";
    let cleanTitle = currentTitle
      .replace("[ARCHIVED] ", "")
      .replace("[DELETED] ", "");

    const finalTitle = `[DELETED] ${cleanTitle}`;

    // Soft delete
    const { error: updateError } = await supabase
      .from("conversations")
      .update({
        title: finalTitle,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId);

    if (updateError) {
      throw updateError;
    }

    Logger.info({
      requestId,
      userId,
      action: "DELETE_CONVERSATION_SUCCESS",
      metadata: { conversationId: id },
    });

    return NextResponse.json({ success: true, message: "Conversation soft deleted" });
  } catch (error: any) {
    Logger.error({
      requestId,
      userId,
      action: "DELETE_CONVERSATION_ERROR",
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.json({ error: "Failed to delete conversation" }, { status: 500 });
  }
}
