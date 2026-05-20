import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabaseInstance: SupabaseClient;

export function getSupabase() {
    if (!supabaseInstance) {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

        if (!supabaseUrl) {
            console.error("SUPABASE_URL environment variable is missing.");
            throw new Error("SUPABASE_URL environment variable is missing.");
        }
        if (!supabaseServiceKey) {
            console.error("SUPABASE_SERVICE_KEY environment variable is missing.");
            throw new Error("SUPABASE_SERVICE_KEY environment variable is missing.");
        }

        supabaseInstance = createClient(supabaseUrl, supabaseServiceKey);
    }
    return supabaseInstance;
}