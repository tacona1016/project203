import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePollInput, fromSeoulInput, toSeoulInput } from "../lib/polls.ts";
import { quarters } from "../data/quarters.ts";

const fixture = { quarter: "2026-q4", poll_type: "choice", results_visibility: "live", text_max_length: 1000, title: "  검토 기준  ", description: "설명", options: ["접근성", "환경"], vote_mode: "single", allow_vote_change: true, scheduled: false, is_hidden: false };
test("poll settings validate choices, title and voting period on server input", () => {
  const value = parsePollInput(fixture, true, quarters);
  assert.equal(value.title, "검토 기준"); assert.equal(value.allow_vote_change, true);
  assert.equal(value.voting_starts_at, null); assert.equal(value.voting_ends_at, null);
  for (const invalid of [{ quarter: undefined }, { quarter: "" }, { quarter: "abc" }, { quarter: "2099-q1" }, { title: " " }, { options: ["one"] }, { options: ["one", " "] }, { vote_mode: "unknown" }, { scheduled: true, start: "2026-10-30T10:00", end: "2026-10-30T09:00" }]) assert.throws(() => parsePollInput({ ...fixture, ...invalid }, true, quarters));
  assert.equal(parsePollInput({ ...fixture, vote_mode: "multiple" }, true, quarters).allow_vote_change, false);
  assert.equal(value.quarter, "2026-q4");
  assert.throws(() => parsePollInput({ ...fixture, quarter: "abc" }, false, quarters));
});
test("Seoul wall clock converts exactly to UTC and rejects invalid calendar dates", () => {
  assert.equal(fromSeoulInput("2026-10-30T09:00"), "2026-10-30T00:00:00.000Z");
  assert.equal(toSeoulInput("2026-10-30T00:00:00Z"), "2026-10-30T09:00");
  assert.throws(() => fromSeoulInput("2026-02-30T09:00"));
  assert.throws(() => fromSeoulInput("2026-10-30T25:00"));
  assert.throws(() => fromSeoulInput("2026-10-30T09:00Z"));
});
