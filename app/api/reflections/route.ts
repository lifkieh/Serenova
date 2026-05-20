import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

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

// Legacy POST kept for backward compat — redirects to new /api/reflections/generate
export async function POST(req: Request) {
    const userId = await getUserId();
    if (!userId) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Forward to the new generate endpoint internally
    const origin = new URL(req.url).origin;
    const res = await fetch(`${origin}/api/reflections/generate`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Cookie": req.headers.get("cookie") || "",
        },
        body: JSON.stringify({ type: "manual", lang: "en" }),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
}
