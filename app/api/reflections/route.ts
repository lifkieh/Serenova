import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { generateWeeklyReflection } from "@/services/reflection/generator";

export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return NextResponse.json({ success: true, data: [] });

        const supabase = getSupabase();
        const { data, error } = await supabase
            .from("reflections")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (error) throw error;
        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error("Reflections list error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

export async function POST() {
    try {
        const userId = await getUserId();
        if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

        const reflection = await generateWeeklyReflection(userId);
        return NextResponse.json({ success: true, data: reflection });
    } catch (error) {
        console.error("Reflection generation error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
