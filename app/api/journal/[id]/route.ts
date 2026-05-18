import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";

interface JournalUpdatePayload {
    title?: string;
    content?: string;
    mood_tag?: string;
    updated_at: string;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userId = await getUserId();
        if (!userId) return NextResponse.json({ success: true, data: null });

        const { id } = await params;
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from("journals")
            .select("*")
            .eq("id", id)
            .eq("user_id", userId)
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error("Journal get error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userId = await getUserId();
        if (!userId) return NextResponse.json({ success: true, message: "Guest mode" });

        const { id } = await params;
        const body = await req.json();
        const { title, content, mood_tag } = body;

        const updateData: JournalUpdatePayload = { updated_at: new Date().toISOString() };
        if (title !== undefined) updateData.title = title;
        if (content !== undefined) updateData.content = content;
        if (mood_tag !== undefined) updateData.mood_tag = mood_tag;

        const supabase = getSupabase();
        const { data, error } = await supabase
            .from("journals")
            .update(updateData)
            .eq("id", id)
            .eq("user_id", userId)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error("Journal patch error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userId = await getUserId();
        if (!userId) return NextResponse.json({ success: true, message: "Guest mode" });

        const { id } = await params;
        const supabase = getSupabase();
        const { error } = await supabase
            .from("journals")
            .delete()
            .eq("id", id)
            .eq("user_id", userId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Journal delete error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
