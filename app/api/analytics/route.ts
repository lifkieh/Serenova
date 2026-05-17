import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getSoftAnalytics } from "@/services/analytics/trends";

export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return NextResponse.json({ success: true, data: null });

        const analytics = await getSoftAnalytics(userId);
        return NextResponse.json({ success: true, data: analytics });
    } catch (error) {
        console.error("Analytics error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
