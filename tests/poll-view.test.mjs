import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePollView, matchesPollView, pollViewHref, choiceResultRows, participationRate, pollDeadline } from "../lib/poll-view.ts";

test("Poll filters distinguish active from upcoming and preserve legacy links", () => {
  assert.deepEqual(parsePollView({}), { status: "active", participation: "all" });
  assert.deepEqual(parsePollView({ tab: "closed" }), { status: "closed", participation: "all" });
  assert.deepEqual(parsePollView({ status: "bad", participation: "pending" }), { status: "active", participation: "pending" });
  assert.deepEqual(parsePollView({ status: ["upcoming"], participation: ["done"] }), { status: "active", participation: "all" });
  assert(matchesPollView({ status: "ACTIVE", ownParticipation: { hasParticipated: false } }, parsePollView({ participation: "pending" })));
  assert.equal(matchesPollView({ status: "UPCOMING" }, parsePollView({})), false);
  assert.equal(matchesPollView({ status: "HIDDEN" }, parsePollView({ status: "all" })), false);
  assert.equal(matchesPollView({ status: "ACTIVE", ownParticipation: null }, parsePollView({ participation: "pending" })), false);
  assert(matchesPollView({ status: "CLOSED", ownParticipation: { hasParticipated: true } }, parsePollView({ status: "closed", participation: "done" })));
  assert.equal(pollViewHref("/polls/2026-q4", { status: "upcoming", participation: "done" }), "/polls/2026-q4?status=upcoming&participation=done");
});

test("result ranking handles ties, stable option order and both percentage denominators", () => {
  const options = [{ id: 1, label: "A" }, { id: 2, label: "B" }, { id: 3, label: "C" }];
  const results = { counts: { 1: 1, 2: 3, 3: 3 }, total_votes: 7, participant_count: 4 };
  const ranked = choiceResultRows(options, results, true, "votes");
  assert.deepEqual(ranked.map(row => row.option.id), [2, 3, 1]);
  assert.equal(ranked[0].leader, "공동 1위"); assert.equal(ranked[1].leader, "공동 1위");
  assert.equal(ranked[0].percentage, 75);
  assert.equal(choiceResultRows(options, results, false, "options")[1].percentage, 43);
  assert.deepEqual(options.map(option => option.id), [1, 2, 3]);
  assert(choiceResultRows(options, { counts: {}, total_votes: 0, participant_count: 0 }, false, "votes").every(row => row.leader === null && row.percentage === 0));
});

test("participation rates never manufacture a denominator or show impossible percentages", () => {
  assert.equal(participationRate(7, 10), 70);
  for (const denominator of [undefined, 0, 6]) assert.equal(participationRate(7, denominator), null);
});

test("deadline messages use server time and never count down a closed or perpetual poll", () => {
  const poll = { voting_starts_at: "2026-11-02T01:00:00Z", voting_ends_at: "2026-11-03T02:00:00Z" };
  assert.equal(pollDeadline(poll, "ACTIVE", "2026-11-02T01:00:00Z"), "마감까지 1일 1시간");
  assert.equal(pollDeadline(poll, "UPCOMING", "2026-11-02T00:45:00Z"), "시작까지 약 15분");
  assert.equal(pollDeadline(poll, "CLOSED", "2026-11-02T00:45:00Z"), null);
  assert.equal(pollDeadline({ voting_starts_at: null, voting_ends_at: null }, "ACTIVE", "2026-11-02T00:45:00Z"), null);
  assert.match(pollDeadline(poll, "ACTIVE", "2026-11-04T00:00:00Z"), /최신 상태/);
});
