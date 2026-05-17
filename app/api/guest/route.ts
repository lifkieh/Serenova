import { NextResponse } from "next/server";

export async function POST() {
    const response = NextResponse.json({
        success: true,
    });

    response.cookies.set("session", "guest", {
        httpOnly: true,
        path: "/",
        maxAge: 60 * 60 * 24,
    });

    return response;
}