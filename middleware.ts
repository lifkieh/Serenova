import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
    const session = req.cookies.get("session");

    const isAuthPage =
        req.nextUrl.pathname === "/login" ||
        req.nextUrl.pathname === "/register";

    const isDashboard =
        req.nextUrl.pathname.startsWith("/dashboard");

    if (!session && isDashboard) {
        return NextResponse.redirect(new URL("/login", req.url));
    }

    if (session && isAuthPage) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
}