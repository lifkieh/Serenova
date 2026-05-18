import { NextResponse } from "next/server";
import { runSafetyStressTest } from "@/services/safety/stressTest";
import { Logger } from "@/services/logging/logger";

/**
 * GET /api/safety/test
 * Internal safety stress testing trigger.
 * Protected by secret key validation to prevent public exposure.
 */
export async function GET(req: Request) {
  const token = req.headers.get("x-safety-token");

  // Validate request is from internal developers using private JWT_SECRET
  if (!token || token !== process.env.JWT_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestId = Logger.generateRequestId();
  Logger.info({
    requestId,
    action: "SAFETY_STRESS_TEST_STARTED",
  });

  try {
    const report = await runSafetyStressTest();

    Logger.info({
      requestId,
      action: "SAFETY_STRESS_TEST_COMPLETED",
      metadata: { accuracy: report.accuracyRate, failures: report.failedCount },
    });

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error: any) {
    Logger.error({
      requestId,
      action: "SAFETY_STRESS_TEST_FAILED",
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: "Stress test execution failed" },
      { status: 500 }
    );
  }
}
