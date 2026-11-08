import assert from "node:assert/strict";
import { test } from "node:test";
import { selectHomePolls } from "../lib/home-view.ts";

function poll(slug, participated, ends = null, created = "2026-11-01T00:00:00Z", status = "ACTIVE") {
  return { poll: { slug, is_hidden: false, voting_ends_at: ends, created_at: created }, status,
    ownParticipation: participated === undefined ? null : { hasParticipated: participated }, results: null };
}
test("Home shows at most three active polls, prioritizing my pending votes then deadlines and recency", () => {
  const items = [poll("done", true, "2026-11-04T00:00:00Z"), poll("older", false),
    poll("recent", false, null, "2026-11-03T00:00:00Z"), poll("deadline", false, "2026-11-10T00:00:00Z"),
    poll("future", false, null, undefined, "UPCOMING"), poll("closed", false, null, undefined, "CLOSED")];
  const before = JSON.stringify(items);
  assert.deepEqual(selectHomePolls(items).map(item => item.poll.slug), ["deadline", "recent", "older"]);
  assert.equal(JSON.stringify(items), before, "UI ordering never mutates the catalog");
});
test("Home preserves unknown participation instead of inventing a pending vote or exposing hidden polls", () => {
  const hidden = poll("hidden", false); hidden.poll.is_hidden = true;
  const items = [poll("done", true), poll("unknown", undefined), hidden, poll("pending", false)];
  assert.deepEqual(selectHomePolls(items).map(item => item.poll.slug), ["pending", "unknown", "done"]);
  assert.equal(selectHomePolls(items)[1].ownParticipation, null);
  assert.deepEqual(selectHomePolls([]), []);
});
