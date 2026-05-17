import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const username = body.username;
        const password = body.password;

        const supabase = getSupabase();
        const { data: user } = await supabase
            .from("users")
            .select("*")
            .eq("username", username)
            .single();

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        const valid = await bcrypt.compare(
            password,
            user.password
        );

        if (!valid) {
            return NextResponse.json(
                { error: "Wrong password" },
                { status: 401 }
            );
        }

        const response = NextResponse.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
            },
        });

        response.cookies.set(
            "session",
            user.username,
            {
                httpOnly: true,
                path: "/",
                maxAge: 60 * 60 * 24 * 7,
            }
        );

        return response;

    } catch {
        return NextResponse.json(
            { error: "Server error" },
            { status: 500 }
        );
    }
}