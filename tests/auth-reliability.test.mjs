import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_SERVICE_MESSAGE, AUTH_RETRY_AFTER_SECONDS, AuthServiceError,
  authServiceHeaders, runAuthLookup, serviceUnavailableHtml, toAuthServiceError,
} from "../lib/auth/service-error.ts";

test("successful and absent auth lookups stay distinct from service failures", async () => {
  const member = { id: "fixture-member", display_name: "Fixture" };
  const reports = [];
  assert.equal(await runAuthLookup(() => member, reason => reports.push(reason)), member);
  assert.equal(await runAuthLookup(async () => null, reason => reports.push(reason)), null);
  assert.deepEqual(reports, []);
});

test("auth service diagnostics distinguish connection, timeout, database, configuration and internal failures", () => {
  const secretCanary = "fixture-upstream-private-details";
  const cases = [
    [{ name: "TypeError", message: "fetch failed " + secretCanary }, undefined, "connection"],
    [{ cause: { code: "ECONNREFUSED" }, message: secretCanary }, undefined, "connection"],
    [{ code: "08006", message: secretCanary }, undefined, "connection"],
    [{ name: "TimeoutError", message: secretCanary }, undefined, "timeout"],
    [{ name: "AbortError", message: secretCanary }, undefined, "timeout"],
    [{ code: "57014", message: secretCanary }, 500, "timeout"],
    [{ message: "TimeoutError: " + secretCanary }, 0, "timeout"],
    [{ code: "42P01", message: secretCanary }, 400, "database"],
    [{ code: "PGRST002", message: secretCanary }, 503, "database"],
    [{ message: secretCanary }, 401, "configuration"],
    [new Error(secretCanary), undefined, "internal"],
  ];
  for (const [source, status, reason] of cases) {
    const failure = toAuthServiceError(source, status);
    assert.equal(failure.reason, reason);
    assert.equal(failure.message, AUTH_SERVICE_MESSAGE);
    assert.equal(failure.message.includes(secretCanary), false);
    assert.equal(failure.cause, undefined);
  }
  const configured = new AuthServiceError("configuration");
  assert.equal(toAuthServiceError(configured), configured);
});

test("auth lookup failures propagate instead of becoming unauthenticated null and report only a reason code", async () => {
  for (const source of [new AuthServiceError("configuration"), { code: "ECONNREFUSED" }, { name: "TimeoutError" }, { code: "42P01" }, new Error("fixture-private-details")]) {
    const reports = [];
    await assert.rejects(runAuthLookup(async () => { throw source; }, reason => reports.push(reason)), error => {
      assert(error instanceof AuthServiceError);
      assert.equal(error.message, AUTH_SERVICE_MESSAGE);
      assert.deepEqual(reports, [error.reason]);
      return true;
    });
  }
});

test("a recovered directory can validate the same lookup without changing authentication state", async () => {
  let available = false;
  const member = { id: "fixture-member", display_name: "Fixture" };
  const query = async () => { if (!available) throw { code: "ECONNRESET" }; return member; };
  await assert.rejects(runAuthLookup(query, () => {}), AuthServiceError);
  available = true;
  assert.equal(await runAuthLookup(query, () => {}), member);
});

test("auth error HTML and headers are retryable, private and contain no protected or upstream data", () => {
  assert.equal(authServiceHeaders["Retry-After"], String(AUTH_RETRY_AFTER_SECONDS));
  assert(authServiceHeaders["Cache-Control"].includes("no-store"));
  assert.equal(authServiceHeaders.Vary, "Cookie");
  assert.equal(Object.hasOwn(authServiceHeaders, "Location"), false);
  assert.equal(Object.hasOwn(authServiceHeaders, "Set-Cookie"), false);
  const html = serviceUnavailableHtml();
  assert(html.includes('lang="ko"'));
  assert(html.includes('href=""'));
  assert(html.includes(AUTH_SERVICE_MESSAGE));
  for (const value of ["project203_member", "participantId", "SUPABASE_SECRET_KEY", "<script", "fixture-private-details"]) assert.equal(html.includes(value), false);
});
