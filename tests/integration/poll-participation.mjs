import assert from "node:assert/strict";

export async function runPollParticipationChecks({ a, b, anonymous, id }) {
  const control = async (body = {}) => (await fetch("http://127.0.0.1:3102/_test", { method: "POST", body: JSON.stringify(body) })).json();
  const before = await control();
  const response = await a.call("/api/polls");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  const first = await response.json();
  assert(first.length > 10);
  assert.equal(first.find(item => item.poll.slug === "land-priority").ownParticipation.hasParticipated, true);
  assert.equal(first.some(item => item.poll.is_hidden), false);
  for (const item of first) {
    assert.deepEqual(Object.keys(item.ownParticipation), ["hasParticipated"]);
    if (item.poll.results_visibility === "after_close" && item.status !== "CLOSED") assert.equal(item.results, null);
  }
  const after = await control();
  const requests = after.participationRequests.slice(before.participationRequests.length);
  assert.equal(requests.length, 2, "choice/text reads are batched instead of one query per Poll");
  assert(requests.every(request => request.participant === `eq.${id(1)}` && request.fields === "poll_id"));
  const second = await (await b.call("/api/polls")).json();
  assert.equal(second.find(item => item.poll.slug === "land-priority").ownParticipation.hasParticipated, false);
  const forged = await (await a.call(`/api/polls?participantId=${id(2)}&authorId=${id(2)}`)).json();
  assert.equal(forged.find(item => item.poll.slug === "land-priority").ownParticipation.hasParticipated, true);
  assert.equal((await anonymous.call("/api/polls")).status, 401);
  await control({ participationFailure: true });
  try {
    const unavailable = await (await a.call("/api/polls")).json();
    assert(unavailable.every(item => item.ownParticipation === null), "outages never become not-participated");
    const home = await (await a.call("/")).text();
    assert(home.includes("확인 불가"));
    assert.equal(home.includes("fixture-private-lookup-outage"), false);
  } finally { await control({ participationFailure: false }); }
  const recovered = await (await a.call("/api/polls")).json();
  assert.equal(recovered.find(item => item.poll.slug === "land-priority").ownParticipation.hasParticipated, true);
  return ["Session-only batched Poll participation; forged member ignored; hidden results preserved; unknown state and outage recovery"];
}
