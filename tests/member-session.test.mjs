import { test } from "node:test";
import assert from "node:assert/strict";
import { createMemberToken, verifyMemberToken, adminSessionKey } from "../lib/auth/member-token.ts";
import { credentialIssue, configuredMemberPassword } from "../lib/auth/credentials.ts";
import { passwordsMatch, signSession, verifySession, SESSION_DURATION } from "../lib/auth/token.ts";

const a = "00000000-0000-4000-8000-000000000001", b = "00000000-0000-4000-8000-000000000002";
const secret = "unit-fixture-only-signing-secret-at-least-32-bytes", password = "unit-fixture-person-password";
const mapping = JSON.stringify({ [a]: password, [b]: password });
const now = 1800000000;

test("member tokens carry a signed UUID and unique login nonce with exactly 30-day expiry", () => {
  const one = createMemberToken(secret, a, password, now), two = createMemberToken(secret, a, password, now);
  const claims = verifyMemberToken(one.token, secret, mapping, now);
  assert.equal(claims.participantId, a);
  assert.equal(claims.expiresAt - claims.issuedAt, SESSION_DURATION);
  assert.notEqual(claims.sessionId, verifyMemberToken(two.token, secret, mapping, now).sessionId);
  assert(verifyMemberToken(one.token, secret, mapping, one.expiresAt - 1));
  assert.equal(verifyMemberToken(one.token, secret, mapping, one.expiresAt), null);
  assert.equal(verifyMemberToken(one.token, secret, mapping, now - 1), null);
  assert.equal(one.token.includes(password), false);
});

test("old access/board proofs, arbitrary IDs, tampering and rotated secrets cannot authenticate", () => {
  const old = signSession(secret, now).token, member = createMemberToken(secret, a, password, now).token;
  for (const token of [old, "", undefined, `${member}.extra`, member.replace(a, b), member.slice(0, -1) + "!", "x".repeat(1500)]) {
    assert.equal(verifyMemberToken(token, secret, mapping, now), null);
  }
  assert.equal(verifyMemberToken(member, secret + "rotated", mapping, now), null);
  assert.throws(() => createMemberToken(secret, "not-a-uuid", password, now));
});

test("shared passwords are accepted but sessions remain bound to the authenticated participant", () => {
  const one = createMemberToken(secret, a, password, now).token, two = createMemberToken(secret, b, password, now).token;
  assert.equal(verifyMemberToken(one, secret, mapping, now).participantId, a);
  assert.equal(verifyMemberToken(two, secret, mapping, now).participantId, b);
  assert.equal(verifyMemberToken(one.replace(a, b), secret, mapping, now), null);
});

test("password rotation/removal and malformed settings revoke existing member sessions", () => {
  const token = createMemberToken(secret, a, password, now).token;
  for (const raw of [undefined, "invalid-json", "[]", "null", "{}", JSON.stringify({ [a]: "short" }), JSON.stringify({ [a]: password + "changed" })]) {
    assert.equal(verifyMemberToken(token, secret, raw, now), null);
  }
  assert(verifyMemberToken(token, secret, JSON.stringify({ [a]: password, [b]: password + "changed" }), now));
});

test("credentials are exact strings including Unicode, quotes, special characters and edge whitespace", () => {
  const exact = '  가짜-fixture-$!#"\\-비밀번호  ';
  const raw = JSON.stringify({ [a]: exact });
  assert.equal(credentialIssue(raw, a), null);
  assert.equal(passwordsMatch(exact, configuredMemberPassword(raw, a)), true);
  assert.equal(passwordsMatch(exact.trim(), configuredMemberPassword(raw, a)), false);
  const token = createMemberToken(secret, a, exact, now).token;
  assert(verifyMemberToken(token, secret, raw, now));
  for (const [value, issue] of [[undefined, "not_configured"], ["[]", "invalid_json"], ["{}", "missing_participant"], [JSON.stringify({ [a]: "short" }), "invalid_length"]]) assert.equal(credentialIssue(value, a), issue);
});

test("8-hour admin proof is bound to a specific member login, including re-login of the same member", () => {
  const memberA = createMemberToken(secret, a, password, now).token, memberB = createMemberToken(secret, b, password, now).token;
  const reLoginA = createMemberToken(secret, a, password, now).token, duration = 28800;
  const key = adminSessionKey(secret, memberA), proof = signSession(key, now, duration).token;
  assert(verifySession(proof, key, now + duration - 1, duration));
  assert.equal(verifySession(proof, key, now + duration, duration), null);
  for (const token of [memberB, reLoginA, ""]) assert.equal(verifySession(proof, adminSessionKey(secret, token), now, duration), null);
  assert.equal(verifyMemberToken(proof, secret, mapping, now), null);
});
