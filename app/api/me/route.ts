import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
    const cookieStore = await cookies();

    const session = cookieStore.get("session");

    if (!session) {
        return NextResponse.json({
            authenticated: false,
        });
    }

    return NextResponse.json({
        authenticated: true,
        role: session.value,
    });
}