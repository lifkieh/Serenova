import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import bcrypt from "bcryptjs";
import { signSession } from "@/lib/session";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
    try {
        const ip = req.headers.get("x-forwarded-for") ?? "unknown";
        const { allowed } = rateLimit(`login:${ip}`, 10, 900_000);
        if (!allowed) {
            return NextResponse.json({ error: "Too many login attempts." }, { status: 429 });
        }

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

        const token = await signSession({ userId: user.id, role: "user" });

        const response = NextResponse.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
            },
        });

        response.cookies.set("session", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
        });

        return response;

    } catch (err) {
        console.error("Login error:", err);
        return NextResponse.json(
            { error: "Server error" },
            { status: 500 }
        );
    }
}