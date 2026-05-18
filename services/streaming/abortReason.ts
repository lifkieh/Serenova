/**
 * Abort reason normalization.
 * req.signal.reason is not runtime-consistent — it can be a string,
 * DOMException, Error, or undefined depending on runtime and caller.
 * This module normalizes all representations into a strict union.
 */

export type AbortReason =
  | "navigation_abort"
  | "manual_abort"
  | "connection_timeout"
  | "idle_timeout"
  | "provider_error"
  | "unknown_abort";

export function normalizeAbortReason(reason: unknown): AbortReason {
  if (!reason) return "unknown_abort";

  // String form (our own typed abort calls)
  if (typeof reason === "string") {
    const lower = reason.toLowerCase();
    if (lower.includes("navigation")) return "navigation_abort";
    if (lower.includes("manual")) return "manual_abort";
    if (lower.includes("connection")) return "connection_timeout";
    if (lower.includes("idle")) return "idle_timeout";
    if (lower.includes("provider")) return "provider_error";
    return "unknown_abort";
  }

  // DOMException or Error object
  if (typeof reason === "object" && reason !== null) {
    const msg = ("message" in reason ? (reason as any).message : "") ?? "";
    const name = ("name" in reason ? (reason as any).name : "") ?? "";
    const combined = `${msg} ${name}`.toLowerCase();
    if (combined.includes("navigation")) return "navigation_abort";
    if (combined.includes("manual")) return "manual_abort";
    if (combined.includes("connection")) return "connection_timeout";
    if (combined.includes("idle")) return "idle_timeout";
    if (combined.includes("provider")) return "provider_error";
    return "unknown_abort";
  }

  return "unknown_abort";
}
