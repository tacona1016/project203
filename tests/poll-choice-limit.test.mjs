import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePollInput } from "../lib/polls.ts";
import { parseChoiceLimit, effectiveChoiceLimit, choiceLimitMessage } from "../lib/poll-choice-limit.ts";
import { quarters } from "../data/quarters.ts";
import { readFileSync } from "node:fs";

const input = { quarter: "2026-q4", title: "선택 기준", description: "", poll_type: "choice", vote_mode: "multiple", options: ["A", "B", "C", "D", "E"], results_visibility: "after_close", text_max_length: 1000, allow_vote_change: true, scheduled: false, is_hidden: false };
test("legacy absent/null limits stay unlimited; numeric 2–5 survive create and edit", () => {
  assert.equal(parseChoiceLimit(undefined), null);
  for (const value of [null, 2, 3, 4, 5]) for (const creating of [true, false]) {
    const parsed = parsePollInput({ ...input, max_choices_per_participant: value }, creating, quarters);
    assert.equal(parsed.max_choices_per_participant, value);
    assert.equal(parsed.results_visibility, "after_close");
    assert.deepEqual(parsed.options, input.options);
  }
  assert.equal(parsePollInput(input, true, quarters).max_choices_per_participant, null);
});
test("selection limits reject forged JSON values, incompatible modes and too few options", () => {
  for (const value of [1, 6, -2, 2.5, NaN, Infinity, "3", "", false, true, [], {}, "null"]) assert.throws(() => parsePollInput({ ...input, max_choices_per_participant: value }, true, quarters), /최대 선택/);
  for (const change of [{ vote_mode: "single" }, { poll_type: "text", vote_mode: "single" }, { options: ["A", "B"] }]) assert.throws(() => parsePollInput({ ...input, max_choices_per_participant: 3, ...change }, true, quarters), /최대 선택/);
  assert.equal(parsePollInput({ ...input, options: [], max_choices_per_participant: 3 }, false, quarters).max_choices_per_participant, 3, "locked options are checked against real saved IDs by API/DB");
});
test("only multiple choice applies a cap; messages describe a maximum, not an exact quota", () => {
  assert.equal(effectiveChoiceLimit({ poll_type: "choice", vote_mode: "multiple" }), null);
  assert.equal(effectiveChoiceLimit({ poll_type: "choice", vote_mode: "multiple", max_choices_per_participant: 3 }), 3);
  for (const poll of [{ poll_type: "choice", vote_mode: "single" }, { poll_type: "text", vote_mode: "single" }]) assert.equal(effectiveChoiceLimit({ ...poll, max_choices_per_participant: 3 }), null);
  assert.match(choiceLimitMessage(3), /최대 3개/);
  assert.match(choiceLimitMessage(3), /해제/);
});
test("unapplied SQL retains atomic canonical ballots, private outcomes and deferred final-set constraints", () => {
  const sql = readFileSync(new URL("../supabase/proposals/poll_multiple_selection_limit.sql", import.meta.url), "utf8");
  // Static safety checks; actual PostgreSQL execution is a separate TEST task.
  assert.equal((sql.match(/\$function\$/g) ?? []).length, 12, "Six complete current RPC/guard bodies");
  assert.match(sql, /!~ '\^\[2-5\]\$'/, "Strict JSON numeric configuration validation");
  assert.match(sql, /array_agg\(distinct id order by id\)/);
  assert(sql.indexOf("'selection_limit_exceeded'") < sql.indexOf("update public.poll_choice_selections set is_selected=false"));
  assert.match(sql, /create constraint trigger choice_selection_maximum[\s\S]*?deferrable initially deferred/i);
  assert.match(sql, /count\(\*\)>0[\s\S]*?previous_exists/);
  assert.doesNotMatch(sql, /delete from public\.(votes|poll_choice_selections|participants|polls)\b/i);
  assert.doesNotMatch(sql, /create or replace function public\.(get_poll_results|get_poll_catalog|get_poll_participation)\b/i);
  assert.doesNotMatch(sql, /disable (?:row level security|trigger)|grant[^;]*\bto (?:anon|authenticated)\b/i);
});
