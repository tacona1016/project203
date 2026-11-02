import { test } from "node:test";
import assert from "node:assert/strict";
import { projectEvents, projectRoadmap, validProjectEvent, projectEventHref, getUpcomingProjectEvents } from "../data/project-plan.ts";

test("the Home roadmap records Q4 targets without an invented completion state or real schedule", () => {
  assert.equal(projectRoadmap.length, 3);
  assert.deepEqual(projectRoadmap.map(step => step.target), ["2027–2028년", "2030년까지", "2035년까지"]);
  assert(projectRoadmap.every(step => !Object.hasOwn(step, "completed") && !Object.hasOwn(step, "progress")));
  assert.deepEqual(projectEvents, []);
});

test("confirmed upcoming events require an explicit timezone and valid internal destination", () => {
  const event = { id: "quarter-meeting", title: "합성 일정", startsAt: "2030-04-01T10:30:00+09:00", href: "/board/12" };
  assert.equal(validProjectEvent(event), true);
  for (const change of [{ startsAt: "2030-04-01T10:30" }, { startsAt: "2030-02-30T10:30:00Z" }, { title: " " }, { href: "https://outside.invalid" }, { href: "/api/participants" }]) {
    assert.equal(validProjectEvent({ ...event, ...change }), false);
  }
  for (const href of ["//outside.invalid", "/\\outside.invalid", "/quarter/%2f%2foutside.invalid", "/board/%0a", "/api/access"]) assert.equal(projectEventHref(href), null);
  assert.equal(projectEventHref("/polls/a-poll#results"), "/polls/a-poll#results");
});

test("next events are future-only, chronological and limited to three without mutating source data", () => {
  const entries = [5, 1, 4, 3, 2].map(day => ({ id: `fixture-${day}`, title: `합성 일정 ${day}`, startsAt: `2030-04-0${day}T09:00:00+09:00` }));
  const snapshot = JSON.stringify(entries);
  const now = Date.parse("2030-04-02T00:00:00Z");
  assert.deepEqual(getUpcomingProjectEvents(entries, now).map(event => event.id), ["fixture-2", "fixture-3", "fixture-4"]);
  assert.equal(JSON.stringify(entries), snapshot);
  assert.deepEqual(getUpcomingProjectEvents(entries, Number.NaN), []);
  assert.deepEqual(getUpcomingProjectEvents([{ ...entries[0], startsAt: "not-a-date" }], now), []);
});
