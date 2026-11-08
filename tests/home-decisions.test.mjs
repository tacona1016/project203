import assert from "node:assert/strict";
import { test } from "node:test";
import { homeDecisionIds, selectHomeDecisions } from "../lib/home-decisions.ts";
import { validContentLinks } from "../data/content-links.ts";

const groups = validContentLinks([
  { quarter: "2026-q4", pollSlugs: ["real-poll", "hidden-poll"], decisionPostIds: ["2", "3", "4", "5", "90071992547409931", "90071992547409932", "2", "invalid"] },
], [{ slug: "2026-q4" }]);
test("Home decisions use explicit registered IDs, never a title, Pin or Poll status", () => {
  assert.deepEqual(homeDecisionIds(groups), ["2", "3", "4", "5", "90071992547409931", "90071992547409932"]);
  assert.deepEqual(selectHomeDecisions([{ id: "1", title: "결정 공지", created_at: "2026-11-01" }], groups), []);
  assert.deepEqual(selectHomeDecisions([{ id: "2", created_at: "2026-11-01" }], []), []);
});
test("Home decisions sort by actual notice registration, preserve large bigint IDs, limit three, and never mutate inputs", () => {
  const notices = ["2", "3", "4", "5", "90071992547409931", "90071992547409932"].map(id => ({ id, created_at: "2026-11-01T00:00:00Z" }));
  const original = JSON.stringify(notices);
  assert.deepEqual(selectHomeDecisions(notices, groups).map(row => row.id), ["90071992547409932", "90071992547409931", "5"]);
  notices[0].created_at = "2026-11-03T00:00:00Z";
  assert.equal(selectHomeDecisions(notices, groups)[0].id, "2");
  notices[0].created_at = "2026-11-01T00:00:00Z";
  assert.equal(JSON.stringify(notices), original);
});
