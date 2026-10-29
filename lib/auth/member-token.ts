import { createHmac, randomUUID } from "node:crypto";
import { signSession, verifySession } from "./token.ts";
import { configuredMemberPassword } from "./credentials.ts";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function signingKey(secret: string, id: string, nonce: string, password: string) {
  return createHmac("sha256", secret).update(JSON.stringify(["203:member-session:v1", id, nonce, password])).digest("hex");
}

export function createMemberToken(secret: string, participantId: string, password: string, now?: number) {
  if (Buffer.byteLength(secret) < 32 || !uuid.test(participantId)) throw new Error("Member configuration unavailable.");
  const nonce = randomUUID();
  const signed = signSession(signingKey(secret, participantId, nonce, password), now);
  return { token: `m1.${participantId}.${nonce}.${signed.token}`, expiresAt: signed.expiresAt };
}

export function verifyMemberToken(token: string | undefined, secret: string, mapping: string | undefined, now?: number) {
  if (!token || token.length > 1400 || Buffer.byteLength(secret) < 32) return null;
  const [version, participantId, nonce, ...signed] = token.split(".");
  if (version !== "m1" || !uuid.test(participantId ?? "") || !uuid.test(nonce ?? "")) return null;
  const password = configuredMemberPassword(mapping, participantId);
  if (!password) return null;
  const claims = verifySession(signed.join("."), signingKey(secret, participantId, nonce, password), now);
  return claims ? { ...claims, participantId, sessionId: nonce } : null;
}

export function adminSessionKey(secret: string, memberToken: string) {
  return Buffer.byteLength(secret) >= 32 && memberToken
    ? createHmac("sha256", secret).update(JSON.stringify(["203:admin-session:v2", memberToken])).digest("hex") : "";
}
