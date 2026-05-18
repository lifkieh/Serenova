import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";

export async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;

  const session = await verifySession(token);
  if (!session) return null;
  if (session.role === "guest") return null;

  return session.userId;
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;
  return verifySession(token);
}
