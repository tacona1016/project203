import assert from "node:assert/strict";

// Real Next API + local Supabase protocol fixture. This is NOT PostgreSQL.
export async function runChoiceLimitChecks({ a, b, anonymous, adminPassword, id }) {
  const control = async value => (await fetch("http://127.0.0.1:3102/_test", { method: "POST", body: JSON.stringify(value) })).json();
  const rpc = async (name, body) => (await fetch("http://127.0.0.1:3102/rest/v1/rpc/" + name, { method: "POST", headers: { apikey: "fixture-only-backend-key", "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  const checks = [];
  assert.equal((await a.call("/api/admin/access", "POST", { password: adminPassword })).status, 200);
  const input = { quarter: "2026-q4", title: "합성 최대 선택 개수", description: "TEST only", poll_type: "choice", vote_mode: "multiple", options: ["A", "B", "C", "D", "E"], results_visibility: "after_close", text_max_length: 1000, allow_vote_change: true, scheduled: false, is_hidden: false };
  async function create(limit) {
    const response = await a.call("/api/admin/polls", "POST", { ...input, max_choices_per_participant: limit });
    assert.equal(response.status, 200);
    const { slug } = await response.json();
    const detail = await (await a.call(`/api/admin/polls/${slug}`)).json();
    assert.equal(detail.poll.max_choices_per_participant, limit);
    assert.equal(detail.has_responses, false);
    return { slug, ids: detail.options.map(option => option.id), pid: detail.poll.id };
  }
  for (const limit of [null, 2, 3, 4, 5]) {
    const { slug, ids } = await create(limit);
    for (const count of [1, 2, 3, 4, 5]) {
      const response = await a.call(`/api/polls/${slug}/votes`, "POST", { optionIds: ids.slice(0, count) });
      assert.equal(response.status, limit !== null && count > limit ? 400 : 200, `${limit} cap / ${count} selected`);
      if (response.status === 400) assert.match((await response.json()).error, /최대 .*개/);
    }
    const member = await (await b.call(`/api/polls/${slug}`)).json();
    assert.equal(member.results, null); assert.equal(member.has_responses, undefined);
    assert.equal((await b.call(`/api/polls/${slug}/votes`, "POST", { optionIds: [ids[0], ids[0], ids[1]] })).status, 200);
    const own = await (await b.call(`/api/polls/${slug}/participation`)).json();
    assert.equal(own.selection_count, 2, "duplicate IDs normalized before cap validation");
    assert.equal((await a.call(`/api/admin/polls/${slug}`, "PATCH", { ...input, options: [], max_choices_per_participant: limit === null ? 3 : null })).status, 409);
    const omitted = await a.call(`/api/admin/polls/${slug}`, "PATCH", { ...input, options: [] });
    assert.equal(omitted.status, 200);
    assert.equal((await (await a.call(`/api/admin/polls/${slug}`)).json()).poll.max_choices_per_participant, limit);
  }
  checks.push("NULL/2/3/4/5 creation, 1..N allowed/N+1 rejected, duplicates deduplicated, per-member sets, privacy, persisted cap and history edit lock");
  for (const invalid of [1, 6, -1, 2.1, "3", false, {}, []]) assert.equal((await a.call("/api/admin/polls", "POST", { ...input, max_choices_per_participant: invalid })).status, 400);
  for (const change of [{ vote_mode: "single" }, { poll_type: "text", vote_mode: "single" }, { options: ["A", "B"] }]) assert.equal((await a.call("/api/admin/polls", "POST", { ...input, max_choices_per_participant: 3, ...change })).status, 400);
  const before = await control({});
  await control({ choiceLimitSchema: false });
  assert.equal((await a.call("/api/admin/polls", "POST", { ...input, max_choices_per_participant: 3 })).status, 503);
  assert.equal((await control({})).polls.length, before.polls.length, "unapplied DB must not silently create unlimited poll");
  assert.equal((await a.call("/api/admin/polls", "POST", input)).status, 200, "old unlimited create still works");
  await control({ choiceLimitSchema: true });
  checks.push("forged values, incompatible modes/options and pre-migration fail-closed create verified without changing old unlimited flow");
  const p = await create(3), voteRoute = `/api/polls/${p.slug}/votes`;
  assert.equal((await anonymous.call(voteRoute, "POST", { optionIds: [p.ids[0]] })).status, 401);
  assert.equal((await b.call("/api/admin/polls", "POST", input)).status, 403);
  assert.equal((await a.call(voteRoute, "POST", { optionIds: p.ids.slice(0,3) }, "https://outside.invalid")).status, 403);
  assert.equal((await a.call(voteRoute, "POST", { optionIds: [-1] })).status, 400);
  assert.equal((await a.call(voteRoute, "POST", { optionIds: [101] })).status, 200);
  // Well-formed but foreign ID reaches RPC and is rejected as an outcome.
  assert.equal(await (await a.call(voteRoute, "POST", { optionIds: [101] })).json(), "invalid_option");
  const submitted = await a.call(voteRoute, "POST", { optionIds: p.ids.slice(0,3) }); assert.equal(await submitted.json(), "success");
  const snapshot = (await control({})).choiceSelections.filter(row => row.poll_id === p.pid);
  const direct = await rpc("submit_choice_ballot", { p_poll_id: p.pid, p_participant_id: id(1), p_option_ids: p.ids.slice(0,4) });
  assert.equal((await direct.json()).status, "selection_limit_exceeded", "synthetic RPC also rejects an API bypass");
  assert.deepEqual((await control({})).choiceSelections.filter(row => row.poll_id === p.pid), snapshot);
  await control({ voteFailure: "constraint" });
  assert.equal((await a.call(voteRoute, "POST", { optionIds: [p.ids[1],p.ids[3]] })).status, 503);
  assert.deepEqual((await control({})).choiceSelections.filter(row => row.poll_id === p.pid), snapshot, "fixture staged replacement rolls back");
  await control({ voteFailure: null });
  const parallel = await Promise.all([a.call(voteRoute,"POST",{optionIds:[p.ids[0],p.ids[3]]}),a.call(voteRoute,"POST",{optionIds:[p.ids[1],p.ids[4]]})]);
  assert(parallel.every(response => response.status === 200));
  assert.equal((await control({})).choiceSelections.filter(row => row.poll_id === p.pid && row.is_selected).length, 2);
  checks.push("auth/origin/foreign IDs, synthetic direct RPC bypass, failure rollback and parallel HTTP set replacement; real DB concurrency remains separate");
  await control({ changePoll: { slug:p.slug, is_hidden:true } }); assert.equal((await a.call(voteRoute,"POST",{optionIds:[p.ids[0]]})).status, 404);
  await control({ changePoll: { slug:p.slug, is_hidden:false, is_closed:true } }); assert.equal(await (await a.call(voteRoute,"POST",{optionIds:[p.ids[0]]})).json(), "poll_closed");
  await control({ changePoll: { slug:p.slug, is_closed:false, allow_vote_change:false } }); assert.equal(await (await a.call(voteRoute,"POST",{optionIds:[p.ids[0]]})).json(), "already_voted");
  // Different unvoted setting; changes do not recreate options.
  const editable=await create(2);
  for (const limit of [null,5,3,2]) assert.equal((await a.call(`/api/admin/polls/${editable.slug}`,"PATCH",{...input,max_choices_per_participant:limit})).status,200);
  assert.deepEqual((await (await a.call(`/api/admin/polls/${editable.slug}`)).json()).options.map(option=>option.id),editable.ids);
  checks.push("hidden/closed/no-change policies and unvoted cap edits preserve option IDs");
  return checks;
}
