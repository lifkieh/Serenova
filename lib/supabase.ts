import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabaseInstance: SupabaseClient;

export function getSupabase() {
    if (!supabaseInstance) {
        supabaseInstance = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_KEY!
        );
    }
    return supabaseInstance;
}