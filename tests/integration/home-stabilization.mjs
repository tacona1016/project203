import assert from "node:assert/strict";

export async function runHomeStabilizationChecks({ a }) {
  const control = async body => (await fetch("http://127.0.0.1:3103/_test", { method: "POST", body: JSON.stringify(body) })).json();
  const load = async () => { const r = await a.call("/"); assert.equal(r.status, 200); return r.text(); };
  const section = (html, key) => new RegExp(`<section\\b[^>]*data-home-section="${key}"`).test(html);
  let html = await load();
  assert(section(html, "decisions")); assert(section(html, "notices"));
  assert(!section(html, "events"));
  assert(!html.includes("fixture-decision-body-not-for-home"));
  assert(!html.includes("fixture-notice-body-not-for-home"));
  const decisionHtml = html.match(/<section\b[^>]*data-home-section="decisions"[\s\S]*?<\/section>/)?.[0];
  assert(decisionHtml?.includes('/polls/land-priority'));
  assert(!decisionHtml.includes('/polls/hidden')); assert(!decisionHtml.includes('/board/1"'));
  const noticeHtml = html.match(/<section\b[^>]*data-home-section="notices"[\s\S]*?<\/section>/)?.[0];
  assert(noticeHtml?.includes('/board/91')); assert(!noticeHtml.includes('/board/90'));
  try {
    await control({ homeBoardMode: "empty" }); html = await load();
    assert(!section(html, "decisions")); assert(!section(html, "notices"));
    assert(!html.includes("공지를 불러오지 못했습니다"));
    await control({ homeBoardMode: "error" }); html = await load();
    assert(html.includes("공지와 결정사항을 불러오지 못했습니다"));
    assert(!html.includes("fixture-private-board-outage"));
    await control({ homeBoardMode: null, changePost: { id: 90, post_type: "general" } }); html = await load();
    assert(!section(html, "decisions"));
    await control({ changePost: { id: 90, post_type: "notice", deleted_at: new Date().toISOString() } }); html = await load();
    assert(!section(html, "decisions"));
  } finally { await control({ homeBoardMode: null, changePost: { id: 90, post_type: "notice", deleted_at: null } }); }
  assert(section(await load(), "decisions"));
  return ["Home empty notices/events omitted; Board outage distinguished/recovered; only explicit existing undeleted notices become decisions; hidden Poll/body never leaked"];
}
