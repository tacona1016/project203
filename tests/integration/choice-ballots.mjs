import assert from "node:assert/strict";

// Real Next.js API calls; the persistence engine here is a synthetic HTTP fixture.
// These checks do not prove PostgreSQL locks or production RLS execution.
export async function runChoiceBallotChecks({ a, b, anonymous, id }) {
  const control = async body => (await fetch("http://127.0.0.1:3102/_test", { method: "POST", body: JSON.stringify(body) })).json();
  const snapshot = () => control({});
  const submit = (who, slug, ids) => who.call(`/api/polls/${slug}/votes`, "POST", { optionIds: ids });
  const outcome = async (who, slug, ids, expected) => {
    const r = await submit(who, slug, ids); assert.equal(r.status, 200); assert.equal(await r.json(), expected);
  };
  const own = async (who, slug) => (await who.call(`/api/polls/${slug}/participation`)).json();
  const results = async (who, slug) => (await who.call(`/api/polls/${slug}/results`)).json();
  const expectedIds = async (who, slug, ids) => {
    const record = await own(who, slug);
    assert.deepEqual(record.option_ids.map(String).sort(), ids.map(String).sort());
    assert.equal(record.selection_count, ids.length); assert.equal(record.vote_count, ids.length);
    assert.equal(record.has_participated, ids.length > 0);
  };
  const rawBefore = (await snapshot()).votes.filter(v => v.option_id !== null);

  assert.equal((await submit(anonymous, "multi-edit", [1201])).status, 401);
  assert.equal((await submit(b, "changeable", [201, 202])).status, 400);
  await outcome(b, "changeable", [201], "success");
  await outcome(b, "changeable", [201], "unchanged");
  await expectedIds(b, "changeable", [201]);
  await outcome(b, "land-priority", [102], "success");
  await outcome(b, "land-priority", [101], "already_voted");
  await expectedIds(b, "land-priority", [102]);

  await expectedIds(a, "repeat", [301, 302, 303]);
  await outcome(b, "repeat", [301, 301, 302], "success");
  await expectedIds(b, "repeat", [301, 302]);
  await outcome(b, "repeat", [301, 302], "already_voted");
  await outcome(b, "repeat", [301], "already_voted");
  const repeated = await results(b, "repeat");
  assert.deepEqual(repeated.results.counts, { 301: 2, 302: 2, 303: 1 });
  assert.equal(repeated.results.total_votes, 5); assert.equal(repeated.results.participant_count, 2);
  assert.equal(JSON.stringify(repeated).includes(id(1)), false);
  assert.equal(JSON.stringify(repeated).includes(id(2)), false);
  assert.equal((await a.call("/api/polls/repeat/votes", "POST", { optionId: 301 })).status, 400);

  await control({ changePoll: { slug: "multi-edit", allow_vote_change: false } });
  const race = await Promise.all([submit(a, "multi-edit", [1201, 1202]), submit(a, "multi-edit", [1201, 1202])]);
  assert.deepEqual((await Promise.all(race.map(r=>r.json()))).sort(), ["already_voted", "success"]);
  await expectedIds(a, "multi-edit", [1201, 1202]);
  await outcome(a, "multi-edit", [1203], "already_voted");
  await control({ changePoll: { slug: "multi-edit", allow_vote_change: true } });
  await outcome(a, "multi-edit", [1201, 1203], "vote_changed");
  await expectedIds(a, "multi-edit", [1201, 1203]);
  let changed = await results(a, "multi-edit");
  assert.equal(changed.results.counts[1201], 1); assert.equal(changed.results.counts[1202] ?? 0, 0); assert.equal(changed.results.counts[1203], 1);
  await outcome(b, "multi-edit", [1201], "success");
  const sameSet = await Promise.all([submit(a, "multi-edit", [1203, 1201]), submit(a, "multi-edit", [1201, 1203])]);
  for (const r of sameSet) assert.equal(await r.json(), "unchanged");
  changed = await results(a, "multi-edit"); assert.equal(changed.results.counts[1201], 2); assert.equal(changed.results.counts[1203], 1);

  const beforeFailure = (await snapshot()).choiceSelections;
  await control({ voteFailure: "constraint" });
  try { assert.equal((await submit(a, "multi-edit", [1202])).status, 503); }
  finally { await control({ voteFailure: null }); }
  assert.deepEqual((await snapshot()).choiceSelections, beforeFailure);
  await expectedIds(a, "multi-edit", [1201, 1203]);

  for (const invalid of [[], [0], ["abc"], [Number.MAX_SAFE_INTEGER + 1], Array.from({length:21},(_,i)=>9000+i)]) assert.equal((await submit(a, "multi-edit", invalid)).status, 400);
  await outcome(a, "multi-edit", [999999], "invalid_option");
  await outcome(a, "multi-edit", [201], "invalid_option");
  for (const body of [{ optionIds: [1201], participantId: id(2) }, { optionIds: [1201], authorId: id(2) }, { optionId: 1201, optionIds: [1202] }, { optionIds: [1201], textResponse: "invalid" }]) assert.equal((await a.call("/api/polls/multi-edit/votes", "POST", body)).status, 400);
  assert.equal((await a.call("/api/polls/multi-edit/participation?participantId=" + id(2))).status, 400);
  await outcome(a, "closed", [501], "poll_closed");
  await outcome(a, "upcoming", [401], "poll_upcoming");

  await outcome(a, "multi-private", [1301, 1302], "success");
  await expectedIds(a, "multi-private", [1301, 1302]);
  await expectedIds(b, "multi-private", []);
  const unpublished = await results(b, "multi-private"); assert.equal(unpublished.results, null); assert.equal(unpublished.responses, null);
  const html = await (await b.call("/polls/multi-private")).text(); assert.equal(html.includes("participant_count"), false);
  await control({ changePoll: { slug: "multi-private", is_closed: true } });
  assert.equal((await results(b, "multi-private")).results.total_votes, 2);
  await outcome(a, "multi-private", [1303], "poll_closed");
  await control({ changePoll: { slug: "multi-private", is_closed: false } });
  assert.equal((await results(b, "multi-private")).results, null);

  const after = await snapshot();
  assert.deepEqual(after.votes.filter(v=>v.option_id!==null), rawBefore, "Original choice votes are preserved verbatim");
  const keys = after.choiceSelections.map(v=>`${v.poll_id}/${v.participant_id}/${v.option_id}`);
  assert.equal(new Set(keys).size, keys.length, "No duplicate canonical row, including inactive choices");
  return [
    "Choice ballots: single exactly one; multiple submits A/B/C together; repeated IDs/requests never accumulate; another member may select the same option",
    "Choice changes: A/B becomes A/C atomically, change-disabled rejects, concurrent HTTP requests keep one canonical row and injected write failure preserves previous state",
    "Choice security: server identity, foreign/missing options, period/status checks, no choice identities in aggregate output, after-close/Reopen policy and original raw vote preservation",
  ];
}
