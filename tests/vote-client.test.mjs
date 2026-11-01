import { test } from "node:test";
import assert from "node:assert/strict";
import { SiteApiError, submitVote, submitTextResponse, getParticipation } from "../lib/site-api.ts";

async function withFetch(implementation, operation) {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (...args) => { calls++; return implementation(...args); };
  try { await operation(() => calls); } finally { globalThis.fetch = previous; }
}

test("choice requests submit a selection array once and never supply a participant identity", async () => {
  await withFetch(async (url, init) => {
    assert.equal(url, "/api/polls/fixture-poll/votes");
    assert.equal(init.method, "POST");
    assert.equal(init.credentials, "same-origin");
    assert.equal(init.cache, "no-store");
    assert.deepEqual(JSON.parse(init.body), { optionIds: [101, "102", 103] });
    return Response.json("success");
  }, async calls => { assert.equal(await submitVote("fixture-poll", [101, "102", 103]), "success"); assert.equal(calls(), 1); });
});

test("a definitive validation failure remains distinct from an uncertain submission", async () => {
  await withFetch(async () => Response.json({ error: "선택지를 확인해주세요." }, { status: 400 }), async calls => {
    await assert.rejects(submitVote("fixture", []), error => error instanceof SiteApiError && error.status === 400 && error.uncertain === false);
    assert.equal(calls(), 1);
  });
});

test("a lost mutation response is uncertain and is never automatically retried", async () => {
  await withFetch(async () => { throw new TypeError("fixture connection lost"); }, async calls => {
    await assert.rejects(submitVote("fixture", [101]), error => error instanceof SiteApiError && error.uncertain);
    assert.equal(calls(), 1);
    await assert.rejects(getParticipation("fixture"), error => error instanceof SiteApiError && !error.uncertain);
    assert.equal(calls(), 2);
  });
});

test("server outages keep their status without treating an unconfirmed write as rolled back", async () => {
  await withFetch(async () => Response.json({ error: "fixture internal details" }, { status: 503 }), async calls => {
    await assert.rejects(submitVote("fixture", [101]), error => {
      assert(error instanceof SiteApiError); assert.equal(error.status, 503); assert.equal(error.uncertain, true);
      assert.equal(error.message.includes("fixture internal details"), false); return true;
    });
    assert.equal(calls(), 1);
  });
});

test("a malformed or unrecognized successful HTTP response is not a vote acknowledgement", async () => {
  for (const response of [() => new Response("not-json"), () => Response.json(null), () => Response.json({ saved: true }), () => Response.json("unexpected-status")]) {
    await withFetch(async () => response(), async calls => {
      await assert.rejects(submitVote("fixture", [101]), error => error instanceof SiteApiError && error.uncertain);
      assert.equal(calls(), 1);
    });
  }
});

test("already-voted and closed are explicit outcomes rather than successful new votes", async () => {
  for (const status of ["already_voted", "poll_closed", "invalid_option", "invalid_selection"]) {
    await withFetch(async () => Response.json(status), async () => assert.equal(await submitVote("fixture", [101]), status));
  }
});

test("text responses retain their existing request shape and uncertain-write handling", async () => {
  await withFetch(async (_url, init) => {
    assert.deepEqual(JSON.parse(init.body), { textResponse: "테스트 응답" });
    return Response.json("vote_changed");
  }, async () => assert.equal(await submitTextResponse("fixture", "테스트 응답"), "vote_changed"));
  await withFetch(async () => { throw new Error("fixture disconnect"); }, async () => {
    await assert.rejects(submitTextResponse("fixture", "테스트 응답"), error => error instanceof SiteApiError && error.uncertain);
  });
});
