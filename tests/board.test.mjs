import { test } from "node:test";
import assert from "node:assert/strict";
import { boardInput, boardCommentInput, boardPage, boardSearch, canManageBoardPost } from "../lib/board/validation.ts";
import { siteImagePath, siteImageContentType } from "../lib/site-images-config.ts";

test("board input rejects injected identity/role, invalid notices, empty/long content and unsafe pagination", () => {
  const value = { title: "  제목  ", content: "  본문  ", post_type: "general", is_pinned: false };
  assert.equal(boardInput(value).title, "제목");
  assert.equal(boardInput(value).content, "본문");
  for (const change of [{ author_id: "other" }, { participant_id: "other" }, { is_admin: true }, { role: "admin" }, { post_type: "other" }, { is_pinned: true }, { title: " " }, { content: "\n\t" }, { content: "가".repeat(10001) }]) assert.throws(() => boardInput({ ...value, ...change }));
  assert.equal(boardInput({ ...value, post_type: "notice", is_pinned: true }).is_pinned, true);
  assert.equal(boardCommentInput({ content: "  😀  " }), "😀");
  for (const input of [{ content: "" }, { content: "x".repeat(2001) }, { content: "test", author_id: "other" }]) assert.throws(() => boardCommentInput(input));
  assert.equal(boardPage(undefined), 1); assert.equal(boardPage("2"), 2);
  for (const page of ["0", "-1", "1.5", "abc", "9999999"]) assert.throws(() => boardPage(page));
  assert.equal(boardSearch("  %_한글  "), "%_한글"); assert.throws(() => boardSearch("x".repeat(101)));
});
test("only a verified author or administrator can manage a post", () => {
  const post = { author_id: "a", post_type: "general" };
  assert.equal(canManageBoardPost(post, { participantId: "a", verified: false, isAdmin: false }), false);
  assert.equal(canManageBoardPost(post, { participantId: "b", verified: true, isAdmin: false }), false);
  assert.equal(canManageBoardPost(post, { participantId: "a", verified: true, isAdmin: false }), true);
  assert.equal(canManageBoardPost({ ...post, post_type: "notice" }, { participantId: "a", verified: true, isAdmin: false }), false);
  assert.equal(canManageBoardPost({ ...post, post_type: "notice" }, { participantId: "b", verified: false, isAdmin: true }), true);
});
test("private image keys and byte signatures reject paths, SVG, HTML and renamed content", () => {
  assert.equal(siteImagePath("boardBanner"), "board/banner.jpg");
  for (const key of ["../.env.local", "home/hero.jpg", "__proto__", "constructor", "boardBanner%00.jpg", "%2e%2e", "/boardBanner"]) assert.equal(siteImagePath(key), null);
  assert.equal(siteImageContentType("a.jpg", Buffer.from([255,216,255,0])), "image/jpeg");
  assert.equal(siteImageContentType("a.png", Buffer.from([137,80,78,71,13,10,26,10])), "image/png");
  for (const [file, content] of [["a.jpg", "<html>"], ["a.svg", "<svg/>"], ["a.jpg", "GIF89a"], ["a.png", "<script>"], ["a.webp", "RIFF1234HTML"]]) assert.equal(siteImageContentType(file, Buffer.from(content)), null);
});
