import { test } from "node:test";
import assert from "node:assert/strict";
import { canShowPollResults, parsePollInput, validateTextResponse } from "../lib/polls.ts";
import { quarters } from "../data/quarters.ts";

const fixture = { quarter: "2026-q4", poll_type: "text", results_visibility: "after_close", text_max_length: 1000,
  title: "후보 지역 의견", description: "", options: [], vote_mode: "multiple", allow_vote_change: true,
  scheduled: false, is_hidden: false };

test("text polls require no options and always use a single editable response", () => {
  const result = parsePollInput(fixture, true, quarters);
  assert.equal(result.poll_type, "text"); assert.equal(result.vote_mode, "single");
  assert.equal(result.allow_vote_change, true); assert.deepEqual(result.options, []);
  assert.equal(result.results_visibility, "after_close");
  for (const invalid of [{ poll_type: "other" }, { results_visibility: "hidden" }, { text_max_length: 9 }, { text_max_length: 5001 }, { text_max_length: 10.5 }, { text_max_length: "1000" }]) {
    assert.throws(() => parsePollInput({ ...fixture, ...invalid }, true, quarters));
  }
  assert.throws(() => parsePollInput({ ...fixture, poll_type: "choice" }, true, quarters));
});

test("after-close publication follows actual status, including hide/reopen transitions", () => {
  for (const status of ["ACTIVE", "UPCOMING", "HIDDEN"]) assert.equal(canShowPollResults({ results_visibility: "after_close" }, status), false);
  assert.equal(canShowPollResults({ results_visibility: "after_close" }, "CLOSED"), true);
  assert.equal(canShowPollResults({ results_visibility: "after_close" }, "ACTIVE"), false, "Reopen hides results again");
  assert.equal(canShowPollResults({ results_visibility: "live" }, "ACTIVE"), true);
  assert.equal(canShowPollResults({ results_visibility: "live" }, "UPCOMING"), true);
  assert.equal(canShowPollResults({ results_visibility: "live" }, "HIDDEN"), false);
});

test("text validation trims whitespace and counts Unicode characters consistently with Postgres", () => {
  assert.equal(validateTextResponse(" \n 양평을 검토합니다. \t ", 100), "양평을 검토합니다.");
  assert.equal(validateTextResponse("😀".repeat(10), 10).length, 20);
  assert.throws(() => validateTextResponse(" \n\t ", 1000));
  assert.throws(() => validateTextResponse("😀".repeat(11), 10));
  assert.throws(() => validateTextResponse(null, 1000));
});
