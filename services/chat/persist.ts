import { getSupabase } from "@/lib/supabase";

export async function persistConversation(userId: string, title?: string, mode: string = "journal"): Promise<string> {
    const supabase = getSupabase();
    
    // Create new conversation
    const { data, error } = await supabase
        .from("conversations")
        .insert([{ user_id: userId, title: title || "New Conversation", mode }])
        .select("id")
        .single();
        
    if (error || !data) {
        console.error("Failed to create conversation:", error);
        throw new Error("Could not create conversation");
    }
    
    return data.id;
}

export async function persistMessage(params: {
    id?: string;
    userId: string;
    conversationId: string;
    role: "user" | "assistant" | "system";
    content: string;
    moodSnapshot?: string;
}) {
    const supabase = getSupabase();
    
    const { error } = await supabase
        .from("messages")
        .insert([{
            id: params.id ?? crypto.randomUUID(),
            user_id: params.userId,
            conversation_id: params.conversationId,
            role: params.role,
            content: params.content,
            mood_snapshot: params.moodSnapshot
        }]);
        
    if (error) {
        console.error("Failed to persist message:", error);
    }
}
