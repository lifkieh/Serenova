import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
    try {
        const ip = req.headers.get("x-forwarded-for") ?? "unknown";
        const { allowed } = rateLimit(`register:${ip}`, 5, 3_600_000);
        if (!allowed) {
            return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
        }

        const body = await req.json();

        const username = body.username?.trim();
        const password = body.password?.trim();

        if (!username || !password) {
            return NextResponse.json(
                { error: "Username and password are required" },
                { status: 400 }
            );
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const supabase = getSupabase();
        const { data: user, error } = await supabase.from("users").insert({
            username,
            password: hashedPassword,
        }).select().single();

        if (error || !user) {
            let errorMessage = "Registration failed";
            if (error?.code === "23505") {
                errorMessage = "Username is already taken";
            } else if (error?.message) {
                errorMessage = error.message;
            }
            return NextResponse.json(
                { error: errorMessage },
                { status: 400 }
            );
        }

        const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret_for_dev_only_change_in_prod");
        const token = await new SignJWT({ userId: user.id, role: "user" })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("7d")
            .sign(secret);

        const response = NextResponse.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
            },
        });

        response.cookies.set(
            "session",
            token,
            {
                httpOnly: true,
                path: "/",
                maxAge: 60 * 60 * 24 * 7,
            }
        );

        return response;
    } catch (err) {
        console.error("Registration error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}