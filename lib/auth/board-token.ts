import { createHmac } from "node:crypto";
import type { BoardPasswordIssue } from "@/lib/board/types";

// An existing proof cannot be reused for another participant or site session.
// Shared passwords are allowed; their holders can verify each matching participant.
export function boardSigningKey(secret: string, participantId: string, password: string, accessToken: string) {
  if (Buffer.byteLength(secret) < 32 || password.length < 10) return "";
  return createHmac("sha256", secret).update(JSON.stringify(["203:board:v1", participantId, password, accessToken])).digest("hex");
}
// Only this non-secret status may be sent to the browser; never the configured value.
export function boardPasswordIssue(raw: string | undefined, participantId: string): BoardPasswordIssue | null {
  if (!raw?.trim()) return "not_configured";
  try {
    const entries: unknown = JSON.parse(raw);
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) return "invalid_json";
    const value = (entries as Record<string, unknown>)[participantId];
    if (typeof value !== "string") return "missing_participant";
    if (value.trim().length < 10 || value.length > 1024) return "invalid_length";
    if (value !== value.trim()) return "whitespace";
    return null;
  } catch { return "invalid_json"; }
}
export function configuredBoardPassword(raw: string | undefined, participantId: string): string | null {
  if (boardPasswordIssue(raw, participantId)) return null;
  return (JSON.parse(raw!) as Record<string, string>)[participantId];
}
