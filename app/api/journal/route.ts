import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return NextResponse.json({ success: true, message: "Guest mode" });

        const body = await req.json();
        const { title, content, type = "free", mood_tag } = body;

        const supabase = getSupabase();
        const { data, error } = await supabase
            .from("journals")
            .insert([{ user_id: userId, title, content, type, mood_tag }])
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error("Journal create error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return NextResponse.json({ success: true, data: [] });

        const supabase = getSupabase();
        const { data, error } = await supabase
            .from("journals")
            .select("id, title, content, type, mood_tag, created_at, updated_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error("Journal list error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
