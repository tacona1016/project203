import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { SESSION_DURATION, passwordsMatch, signSession, verifySession } from "../lib/auth/token.ts";

// Synthetic test input only; not a deployed password or session secret.
const fixtureKey = "unit-test-only-key-with-at-least-32-bytes";
const now = 1800000000;

test("session and signed expiry last exactly 30 days", () => {
  const { token, expiresAt } = signSession(fixtureKey, now);
  assert.equal(SESSION_DURATION, 2592000);
  assert.equal(expiresAt, now + SESSION_DURATION);
  assert.equal(verifySession(token, fixtureKey, expiresAt - 1)?.authorized, true);
  assert.equal(verifySession(token, fixtureKey, expiresAt), null);
  assert.equal(verifySession(token, fixtureKey, now - 1), null);
});

test("tampering, wrong keys, missing config and malformed tokens fail closed", () => {
  const { token } = signSession(fixtureKey, now);
  const [version, body, signature] = token.split(".");
  assert.equal(verifySession(`${version}.${body}.${signature[0] === "a" ? "b" : "a"}${signature.slice(1)}`, fixtureKey, now), null);
  assert.equal(verifySession(token, fixtureKey + "rotated", now), null);
  assert.equal(verifySession(token, "", now), null);
  for (const value of [undefined, "", "x.y.z", "v1.!.!", token + ".extra", "a".repeat(1025)]) assert.equal(verifySession(value, fixtureKey, now), null);
  assert.throws(() => signSession("short", now));
});

test("even signed claims require a valid authorization flag and bounded lifetime", () => {
  for (const claims of [
    { authorized: false, issuedAt: now, expiresAt: now + SESSION_DURATION },
    { authorized: true, issuedAt: now, expiresAt: now + SESSION_DURATION + 1 },
    { authorized: true, issuedAt: "now", expiresAt: now + SESSION_DURATION },
  ]) {
    const body = `v1.${Buffer.from(JSON.stringify(claims)).toString("base64url")}`;
    const signature = createHmac("sha256", fixtureKey).update(body).digest("base64url");
    assert.equal(verifySession(`${body}.${signature}`, fixtureKey, now), null);
  }
});

test("password comparison handles different lengths and Unicode", () => {
  assert.equal(passwordsMatch("test-value", "test-value"), true);
  assert.equal(passwordsMatch("test", "test-value"), false);
  assert.equal(passwordsMatch("테스트", "다른값"), false);
  assert.equal(passwordsMatch("테스트", "테스트"), true);
});
