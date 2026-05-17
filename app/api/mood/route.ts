import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return NextResponse.json({ success: true, message: "Guest mode - not saved" });

        const body = await req.json();
        const { mood } = body;

        if (!mood) return NextResponse.json({ error: "Mood is required" }, { status: 400 });

        const supabase = getSupabase();
        const { data, error } = await supabase
            .from("moods")
            .insert([{ user_id: userId, mood, source: "manual" }])
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return NextResponse.json({ success: true, data: [] });

        const supabase = getSupabase();
        const { data, error } = await supabase
            .from("moods")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(10);

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
