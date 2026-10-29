export type CredentialIssue = "not_configured" | "invalid_json" | "missing_participant" | "invalid_length";

// Server callers must never serialize the mapping or a configured password.
export function credentialIssue(raw: string | undefined, participantId: string): CredentialIssue | null {
  if (!raw) return "not_configured";
  try {
    const entries: unknown = JSON.parse(raw);
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) return "invalid_json";
    const value = Object.hasOwn(entries, participantId) ? (entries as Record<string, unknown>)[participantId] : undefined;
    if (typeof value !== "string") return "missing_participant";
    if (value.length < 10 || value.length > 1024 || !value.trim()) return "invalid_length";
    return null;
  } catch { return "invalid_json"; }
}

export function configuredMemberPassword(raw: string | undefined, participantId: string): string | null {
  return credentialIssue(raw, participantId) ? null : (JSON.parse(raw!) as Record<string, string>)[participantId];
}
