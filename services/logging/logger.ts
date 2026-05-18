import { randomUUID } from "crypto";

export interface LogPayload {
  requestId?: string;
  userId?: string;
  action: string;
  durationMs?: number;
  model?: string;
  tokensUsed?: number;
  safetyFlags?: Record<string, boolean>;
  metadata?: Record<string, any>;
  error?: string;
  stack?: string;
}

export class Logger {
  /**
   * Generates a unique request trace ID
   */
  public static generateRequestId(): string {
    return `req_${randomUUID()}`;
  }

  /**
   * Structured Info Log
   */
  public static info(payload: LogPayload) {
    const log = {
      timestamp: new Date().toISOString(),
      level: "INFO",
      ...payload,
    };
    // In production, we log structured JSON. In development, we can print it nicely.
    if (process.env.NODE_ENV === "development") {
      const durationStr = payload.durationMs ? ` (${payload.durationMs}ms)` : "";
      const tokensStr = payload.tokensUsed ? ` [Tokens: ${payload.tokensUsed}]` : "";
      console.log(
        `[${log.timestamp}] \x1b[32mINFO\x1b[0m [${payload.action}]${durationStr}${tokensStr} - Request: ${payload.requestId || "N/A"}, User: ${payload.userId || "guest"}`
      );
      if (payload.metadata) {
        console.log("Metadata:", JSON.stringify(payload.metadata, null, 2));
      }
    } else {
      console.log(JSON.stringify(log));
    }
  }

  /**
   * Structured Warning Log (e.g. safety triggers, rate limits)
   */
  public static warn(payload: LogPayload) {
    const log = {
      timestamp: new Date().toISOString(),
      level: "WARN",
      ...payload,
    };
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[${log.timestamp}] \x1b[33mWARN\x1b[0m [${payload.action}] - Request: ${payload.requestId || "N/A"}, User: ${payload.userId || "guest"}`
      );
      if (payload.safetyFlags) {
        console.warn("Safety Flags Triggered:", JSON.stringify(payload.safetyFlags));
      }
      if (payload.metadata) {
        console.warn("Metadata:", JSON.stringify(payload.metadata, null, 2));
      }
    } else {
      console.warn(JSON.stringify(log));
    }
  }

  /**
   * Structured Error Log
   */
  public static error(payload: LogPayload) {
    const log = {
      timestamp: new Date().toISOString(),
      level: "ERROR",
      ...payload,
    };
    if (process.env.NODE_ENV === "development") {
      console.error(
        `[${log.timestamp}] \x1b[31mERROR\x1b[0m [${payload.action}] - Request: ${payload.requestId || "N/A"}, Error: ${payload.error}`
      );
      if (payload.stack) {
        console.error(payload.stack);
      }
    } else {
      console.error(JSON.stringify(log));
    }
  }
}
