import { test } from "node:test";
import assert from "node:assert/strict";
import { getArchivedQuarters, getCurrentQuarter, getQuarterLabel, getSortedQuarters } from "../data/quarters.ts";
import { getQuarterPolls, getPollCounts } from "../lib/polls.ts";

const entries = [
  { slug: "2026-q4", year: 2026, quarter: 4, publishedAt: "2026-10-19" },
  { slug: "2027-q2", year: 2027, quarter: 2, publishedAt: "2027-04-01" },
  { slug: "2027-q1", year: 2027, quarter: 1, publishedAt: "2027-01-01" },
];

test("current and archived quarters share metadata ordering, independent of today's month", () => {
  assert.equal(getCurrentQuarter(entries).slug, "2027-q2");
  assert.deepEqual(getArchivedQuarters(entries).map((quarter) => quarter.slug), ["2027-q1", "2026-q4"]);
  assert.equal(getQuarterLabel(entries[0]), "2026 Q4");
  assert.equal(getCurrentQuarter([]), undefined);
  getSortedQuarters(entries);
  assert.equal(entries[0].slug, "2026-q4", "sorting must not mutate metadata");
});

test("quarter filtering preserves past active polls and sorts active, upcoming, closed", () => {
  const row = (id, quarter, status, date = "2026-10-23") => ({ poll: { id, quarter, created_at: date }, status });
  const catalog = [row(1, "2026-q4", "CLOSED"), row(2, "2027-q1", "ACTIVE"), row(3, "2026-q4", "UPCOMING"), row(4, "2026-q4", "ACTIVE"), row(5, "2026-q4", "ACTIVE", "2026-10-24")];
  const past = getQuarterPolls(catalog, "2026-q4");
  assert.deepEqual(past.map((item) => item.poll.id), [5, 4, 3, 1]);
  assert.equal(past[0].status, "ACTIVE", "an old quarter never closes an active poll");
  assert.deepEqual(getPollCounts(past), { total: 4, active: 2, upcoming: 1, closed: 1, hidden: 0 });
  assert.deepEqual(getQuarterPolls(catalog, "2027-q2"), []);
});
