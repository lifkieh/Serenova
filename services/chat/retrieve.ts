import { getSupabase } from "@/lib/supabase";

export async function getConversationHistory(conversationId: string, userId: string) {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
        .from("messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
        
    if (error) {
        console.error("Failed to fetch history:", error);
        return [];
    }
    
    return data;
}

export async function getLatestConversations(userId: string) {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
        .from("conversations")
        .select("id, title, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(10);
        
    if (error) {
        console.error("Failed to fetch conversations:", error);
        return [];
    }
    
    return data;
}
