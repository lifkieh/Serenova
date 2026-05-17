import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const username = body.username?.trim();
        const password = body.password?.trim();

        if (!username || !password) {
            return NextResponse.json(
                { error: "Username dan password wajib diisi" },
                { status: 400 }
            );
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const supabase = getSupabase();
        const { error } = await supabase.from("users").insert({
            username,
            password: hashedPassword,
        });

        if (error) {
            return NextResponse.json(
                { error: error.message },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
        });
    } catch (err) {
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}