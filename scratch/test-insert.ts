import { getSupabase } from "../lib/supabase";

async function run() {
    const supabase = getSupabase();
    console.log("Testing insert into reflections...");
    
    const { data, error } = await supabase.from("reflections").insert([{
        user_id: "00000000-0000-0000-0000-000000000000",
        type: "weekly",
        period_start: new Date().toISOString(),
        period_end: new Date().toISOString(),
        content: "Test reflection content",
        lang: "en",
        model_used: "test-model",
        verbosity_preference: "concise",
        needs_review: false
    }]).select();

    if (error) {
        console.error("Insert error:", error);
    } else {
        console.log("Insert success:", data);
        // Clean up the dummy row
        if (data && data.length > 0) {
            const id = data[0].id;
            await supabase.from("reflections").delete().eq("id", id);
            console.log("Cleanup success.");
        }
    }
}

run();
