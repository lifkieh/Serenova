import { NextResponse } from "next/server";
import { signSession } from "@/lib/session";

export async function POST() {
    const response = NextResponse.json({
        success: true,
    });

    const token = await signSession({ userId: "guest", role: "guest" });
    response.cookies.set("session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24, // 24h for guest
    });

    return response;
}