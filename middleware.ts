import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/session";

const PROTECTED_ROUTES = ["/dashboard", "/journal", "/analytics", "/reflections"];
const AUTH_ROUTES = ["/login", "/register"];

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  const pathname = req.nextUrl.pathname;

  const isProtected = PROTECTED_ROUTES.some(r => pathname.startsWith(r));
  const isAuthPage = AUTH_ROUTES.some(r => pathname.startsWith(r));

  if (isProtected) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    const session = await verifySession(token);
    if (!session) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  if (isAuthPage && token) {
    const session = await verifySession(token);
    if (session) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
