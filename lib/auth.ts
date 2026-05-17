import { cookies } from "next/headers";
import { getSupabase } from "@/lib/supabase";

export async function getUserId(): Promise<string | null> {
    const cookieStore = await cookies();
    const session = cookieStore.get("session");
    
    if (!session || session.value === "guest") return null;
    
    const supabase = getSupabase();
    const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("username", session.value)
        .single();
        
    return user?.id || null;
}
