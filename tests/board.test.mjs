import { test } from "node:test";
import assert from "node:assert/strict";
import { BOARD_LIMITS, boardInput, boardCommentInput, boardPage, boardSearch, boardTextLength, canManageBoardPost } from "../lib/board/validation.ts";
import { DECISION_RECORD_TEMPLATE } from "../lib/board/decision-template.ts";
import { readFileSync } from "node:fs";
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
test("BOARD uses trimmed Unicode code points for Korean, emoji and newlines at exact input limits", () => {
  assert.equal(boardTextLength("  한글😀\n끝  "), 5);
  assert.equal(boardTextLength("한글😀\r\n끝"), 6);
  assert.equal(boardTextLength("e\u0301"), 2);
  assert.equal(boardTextLength("👨‍👩‍👧‍👦"), 7);
  assert.equal(boardTextLength(" \n\t "), 0);
  const fixture = Object.freeze({ title: "제목", content: "본문", post_type: "general", is_pinned: false });
  for (const character of ["가", "😀"]) {
    const title = character.repeat(BOARD_LIMITS.title), content = character.repeat(BOARD_LIMITS.content), comment = character.repeat(BOARD_LIMITS.comment);
    assert.equal(boardInput({ ...fixture, title, content }).content, content);
    assert.equal(boardInput({ ...fixture, title, content }).title, title);
    assert.equal(boardCommentInput({ content: `  ${comment}\n` }), comment);
    assert.throws(() => boardInput({ ...fixture, title: title + character }));
    assert.throws(() => boardInput({ ...fixture, content: content + character }));
    assert.throws(() => boardCommentInput({ content: comment + character }));
  }
  const existingContent = "기존 글\r\n이모지 😀\n조합 e\u0301";
  assert.equal(boardInput({ ...fixture, content: existingContent }).content, existingContent);
  assert.equal(boardCommentInput({ content: existingContent }), existingContent);
  assert.equal(fixture.content, "본문");
});
test("decision draft matches the documented template and stays within existing Board validation", () => {
  const guide = readFileSync(new URL("../docs/DECISION_RECORD_TEMPLATE.md", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.equal(guide.match(/```text\n([\s\S]*?)\n```/)[1], DECISION_RECORD_TEMPLATE);
  const post = boardInput({ title: "[결정] 결정 제목", content: DECISION_RECORD_TEMPLATE, post_type: "notice", is_pinned: false });
  assert.equal(post.content, DECISION_RECORD_TEMPLATE);
  assert.equal(post.is_pinned, false);
  for (const field of ["결정 제목:", "결정일:", "최종 결정 내용", "관련 투표", "결정 근거", "담당자", "다음 행동", "목표 일정", "추후 변경 사항"]) assert(DECISION_RECORD_TEMPLATE.includes(field));
});
test("private image keys and byte signatures reject paths, SVG, HTML and renamed content", () => {
  assert.equal(siteImagePath("boardBanner"), "board/banner.jpg");
  for (const key of ["../.env.local", "home/hero.jpg", "__proto__", "constructor", "boardBanner%00.jpg", "%2e%2e", "/boardBanner"]) assert.equal(siteImagePath(key), null);
  assert.equal(siteImageContentType("a.jpg", Buffer.from([255,216,255,0])), "image/jpeg");
  assert.equal(siteImageContentType("a.png", Buffer.from([137,80,78,71,13,10,26,10])), "image/png");
  for (const [file, content] of [["a.jpg", "<html>"], ["a.svg", "<svg/>"], ["a.jpg", "GIF89a"], ["a.png", "<script>"], ["a.webp", "RIFF1234HTML"]]) assert.equal(siteImageContentType(file, Buffer.from(content)), null);
});
