import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_DURATION = 60 * 60 * 24 * 30;
const TOKEN_VERSION = "v1";

type SessionPayload = { authorized: true; issuedAt: number; expiresAt: number };

// Node's standard HMAC-SHA256 authenticates the payload; no password is stored in it.
export function signSession(secret: string, now = Math.floor(Date.now() / 1000)) {
  if (Buffer.byteLength(secret) < 32) throw new Error("Session configuration unavailable.");
  const payload: SessionPayload = { authorized: true, issuedAt: now, expiresAt: now + SESSION_DURATION };
  const body = `${TOKEN_VERSION}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return { token: `${body}.${signature}`, expiresAt: payload.expiresAt };
}

export function verifySession(token: string | undefined, secret: string, now = Math.floor(Date.now() / 1000)): SessionPayload | null {
  if (!token || token.length > 1024 || Buffer.byteLength(secret) < 32) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION || !/^[A-Za-z0-9_-]+$/.test(parts[1]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[2])) return null;
  const expected = createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest();
  const actual = Buffer.from(parts[2], "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected) || actual.toString("base64url") !== parts[2]) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (payload?.authorized !== true || !Number.isSafeInteger(payload.issuedAt) || !Number.isSafeInteger(payload.expiresAt)
      || payload.issuedAt > now || payload.expiresAt <= now || payload.expiresAt - payload.issuedAt !== SESSION_DURATION) return null;
    return { authorized: true, issuedAt: payload.issuedAt, expiresAt: payload.expiresAt };
  } catch {
    return null;
  }
}

export function passwordsMatch(input: string, expected: string) {
  // Fixed-length digests avoid leaking password length through the comparison.
  return timingSafeEqual(createHash("sha256").update(input).digest(), createHash("sha256").update(expected).digest());
}
