import assert from "node:assert/strict";

export async function runWebsiteFeatureChecks({ a, b, anonymous, id, adminPassword }) {
  const post = await (await a.call("/api/board/posts", "POST", { title: "Website flow fixture", content: "Synthetic record only", post_type: "general", is_pinned: false })).json();
  const comment = await (await a.call(`/api/board/posts/${post.id}/comments`, "POST", { content: "original fixture comment" })).json();
  const route = `/api/board/posts/${post.id}/comments/${comment.id}`;
  assert.equal((await anonymous.call(route, "PATCH", { content: "forged" })).status, 401);
  assert.equal((await b.call(route, "PATCH", { content: "other participant" })).status, 403);
  assert.equal((await b.call("/api/admin/access", "POST", { password: adminPassword })).status, 200);
  assert.equal((await b.call(route, "PATCH", { content: "admin cannot rewrite someone else" })).status, 403);
  for (const value of [{ content: " " }, { content: "가".repeat(2001) }, { content: "forged", author_id: id(2) }, { content: "forged", participantId: id(2) }]) assert.equal((await a.call(route, "PATCH", value)).status, 400);
  assert.equal((await a.call(route, "PATCH", { content: "cross origin" }, "https://outside.invalid")).status, 403);
  const saved = await a.call(route, "PATCH", { content: "  수정한 합성 댓글 😀  " });
  assert.equal(saved.status, 200);
  const updated = await saved.json();
  assert.equal(updated.content, "수정한 합성 댓글 😀");
  assert.equal(String(updated.id), String(comment.id));
  assert(Number.isFinite(Date.parse(updated.updated_at)));
  const comments = await (await a.call(`/api/board/posts/${post.id}/comments`)).json();
  assert.equal(comments.find(row => String(row.id) === String(comment.id)).author_id, id(1));
  assert.equal((await a.call(`/api/board/posts/999999/comments/${comment.id}`, "PATCH", { content: "wrong post" })).status, 404);
  assert.equal((await a.call(route, "DELETE")).status, 200);
  assert.equal((await a.call(route, "PATCH", { content: "deleted" })).status, 404);

  for (let index = 0; index < 5; index++) assert.equal((await a.call("/api/board/posts", "POST", {
    title: `UX notice ${index}`, content: `fixture-home-private-body-${index}`, post_type: "notice", is_pinned: index % 2 === 0,
  })).status, 200);
  const state = await (await fetch("http://127.0.0.1:3103/_test")).json();
  const expected = state.posts.filter(row => row.post_type === "notice" && !row.deleted_at && ![90,92,93].includes(row.id))
    .sort((left, right) => right.created_at.localeCompare(left.created_at) || right.id - left.id).slice(0, 3);
  const home = await (await a.call("/")).text();
  for (const notice of expected) assert(home.includes(notice.title));
  assert.equal(home.includes("fixture-home-private-body-"), false);
  assert.equal(home.includes("fixture-decision-body-not-for-home"), false);
  assert(home.includes("목표 일정"));
  assert(home.includes("합성 후보 A") && home.includes("합성 후보 B"));
  const related = await (await a.call("/quarter/2026-q4")).text();
  assert(related.includes("합성 결정 공지"));
  assert.equal(related.includes('href="/polls/hidden"'), false);
  assert.equal(related.includes('href="/polls/missing"'), false);
  assert.equal(related.includes('href="/board/999"'), false);
  assert.equal(related.includes('href="/board/1"'), false, "General posts are not decision notices");
  const catalog = await (await a.call("/api/polls")).json();
  assert.equal(catalog.find(item => item.poll.slug === "land-priority").results.eligible_participant_count, 10);
  for (const slug of ["text-private", "choice-private", "multi-private"]) {
    const detail = await (await a.call(`/api/polls/${slug}`)).json();
    assert.equal(detail.results, null);
    assert.equal(JSON.stringify(detail).includes("eligible_participant_count"), false);
  }
  const active = await (await a.call("/polls/2026-q4?status=active")).text();
  const upcoming = await (await a.call("/polls/2026-q4?status=upcoming")).text();
  assert.equal(active.includes('href="/polls/upcoming"'), false);
  assert(upcoming.includes('href="/polls/upcoming"'));
  assert.equal(upcoming.includes('href="/polls/land-priority"'), false);
  return ["Own-comment edit uses session identity and preserves IDs; admin cannot rewrite others; invalid/deleted/cross-origin edits rejected", "Home notices are pinned/latest three titles without bodies; explicit related links exclude hidden/missing/general records", "Published participation denominators and distinct ACTIVE/UPCOMING filters preserve private results"];
}
