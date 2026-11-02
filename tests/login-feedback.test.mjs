import { test } from "node:test";
import assert from "node:assert/strict";
import { loginFailureMessage } from "../lib/auth/login-feedback.ts";
import { AUTH_SERVICE_MESSAGE } from "../lib/auth/service-error.ts";

test("login feedback separates credential, service and platform throttling failures", () => {
  assert.equal(loginFailureMessage(401, null), "이름과 비밀번호를 확인해주세요.");
  assert.equal(loginFailureMessage(401, null, "admin"), "비밀번호가 올바르지 않습니다.");
  assert.equal(loginFailureMessage(503, null), AUTH_SERVICE_MESSAGE);
  assert.equal(loginFailureMessage(429, "60"), "로그인 시도가 많습니다. 60초 후 다시 시도해주세요.");
  assert.equal(loginFailureMessage(429, null), "로그인 시도가 많습니다. 잠시 후 다시 시도해주세요.");
  assert.equal(loginFailureMessage(403, null), "로그인하지 못했습니다. 잠시 후 다시 시도해주세요.");
});

test("Retry-After dates are bounded display data and cannot inject response content", () => {
  const now = Date.UTC(2026, 10, 1, 0, 0, 0);
  assert.equal(loginFailureMessage(429, new Date(now + 45_000).toUTCString(), "member", now), "로그인 시도가 많습니다. 45초 후 다시 시도해주세요.");
  for (const value of ["", "-2", "0", "601", "999999999999999999999", "<script>private-header</script>", new Date(now - 60_000).toUTCString(), "x".repeat(200)]) {
    const message = loginFailureMessage(429, value, "member", now);
    assert.equal(message, "로그인 시도가 많습니다. 잠시 후 다시 시도해주세요.");
    assert.equal(message.includes("private-header"), false);
  }
});

