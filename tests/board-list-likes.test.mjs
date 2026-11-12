import assert from "node:assert/strict";
import { test } from "node:test";
import { boardPagePostIds, withBoardLikeCounts } from "../lib/board/list-likes.ts";

const page = { pinned: [{ id: "90", title: "notice", comment_count: 4 }], posts: [{ id: 1, title: "old post", comment_count: 0 }, { id: "9223372036854775807", title: "large id", comment_count: 2 }], total: 20, page: 2, page_size: 10 };
test("Board batch counts zero, one and multiple likes for notices and posts, without altering list metadata", () => {
  const result = withBoardLikeCounts(page, [{ post_id: 90 }, { post_id: "90" }, { post_id: "9223372036854775807" }], 3);
  assert.equal(result.pinned[0].like_count, 2);
  assert.deepEqual(result.posts.map(p => p.like_count), [0, 1]);
  assert.equal(result.pinned[0].comment_count, 4);
  assert.equal(result.total, 20); assert.equal(result.page, 2);
  assert.equal(page.pinned[0].like_count, undefined);
  assert.deepEqual(boardPagePostIds({ ...page, posts: [...page.posts, { id: 90 }] }), [90, 1, "9223372036854775807"]);
});
test("Empty successful batches mean zero, unavailable or truncated counts stay unknown", () => {
  assert.equal(withBoardLikeCounts(page, [], 0).posts[0].like_count, 0);
  for (const [rows, count] of [[null, null], [[], null], [[], 2], [[{post_id:999}],1], [[], -1]]) {
    const r=withBoardLikeCounts(page, rows, count);
    assert(r.posts.every(p=>p.like_count===null)); assert.equal(r.pinned[0].like_count, null);
  }
  assert.deepEqual(boardPagePostIds({ ...page, posts: [], pinned: [] }), []);
});
