import { test } from "node:test";
import assert from "node:assert/strict";
import { BOARD_DRAFT_TTL, boardDraftKey, createBoardDraft, readBoardDraft } from "../lib/board/draft.ts";
import { boardPostHref, boardReturnTo, isRecentBoardPost } from "../lib/board/view.ts";
import { boardTextParts } from "../lib/board/text.ts";

const now = Date.parse("2026-11-02T03:00:00Z");
const input = { title: "  합성 제목  ", content: "첫 줄\r\n이모지 😀\n마지막", post_type: "general", is_pinned: false };

test("opt-in Board draft payload is scoped to member and compose/edit type, expires after seven days", () => {
  const draft = createBoardDraft("member-a", "new:general", input, now), raw = JSON.stringify(draft);
  assert.equal(draft.expiresAt - draft.savedAt, BOARD_DRAFT_TTL);
  assert.equal(readBoardDraft(raw, "member-a", "new:general", now + 1).content, input.content);
  assert.equal(readBoardDraft(raw, "member-b", "new:general", now + 1), null);
  assert.equal(readBoardDraft(raw, "member-a", "edit-1:general", now + 1), null);
  assert.equal(readBoardDraft(raw, "member-a", "new:notice", now + 1), null);
  assert.equal(readBoardDraft(raw, "member-a", "new:general", now + BOARD_DRAFT_TTL), null);
  assert.equal(readBoardDraft(raw, "member-a", "new:general", now - 1), null);
  for (const raw of ["invalid-json", "null", "[]", JSON.stringify({ ...draft, expiresAt: draft.expiresAt + 1 }), JSON.stringify({ ...draft, content: 9 }), JSON.stringify({ ...draft, post_type: "admin" }), JSON.stringify({ ...draft, is_pinned: true })]) {
    assert.equal(readBoardDraft(raw, "member-a", "new:general", now + 1), null);
  }
  assert.notEqual(boardDraftKey("member-a", "new:general"), boardDraftKey("member-b", "new:general"));
  assert.notEqual(boardDraftKey("member-a", "new:general"), boardDraftKey("member-a", "edit-1:general"));
});

test("drafts preserve raw input and Unicode while bounding stored text with existing Board limits", () => {
  const original = structuredClone(input);
  const draft = createBoardDraft("member-a", "new:general", input, now);
  assert.equal(draft.title, input.title); assert.equal(draft.content, input.content); assert.deepEqual(input, original);
  assert.equal(createBoardDraft("member-a", "new:general", { ...input, content: "😀".repeat(10000) }, now).content.length, 20000);
  assert.throws(() => createBoardDraft("member-a", "new:general", { ...input, content: "😀".repeat(10001) }, now));
  assert.equal(readBoardDraft(JSON.stringify({ ...draft, content: "가".repeat(10001) }), "member-a", "new:general", now + 1), null);
});

test("Board return links preserve only validated search/page and cannot redirect outside the Board list", () => {
  const returned = boardReturnTo("/board?q=%ED%95%9C%EA%B8%80&page=2&role=admin");
  assert.equal(returned, "/board?q=%ED%95%9C%EA%B8%80&page=2");
  for (const value of ["https://outside.invalid/board", "//outside.invalid/board", "/api/polls", "/board/1", "/board#secret", "/board?page=0", "/board?page=1.5", "/board?q=" + "x".repeat(101), "/\\outside.invalid", {}, null]) assert.equal(boardReturnTo(value), "/board");
  const detail = new URL(boardPostHref(42, returned), "https://project203.invalid");
  assert.equal(detail.pathname, "/board/42"); assert.equal(detail.searchParams.get("returnTo"), returned);
  assert.equal(isRecentBoardPost(new Date(now - 7 * 86400000 + 1).toISOString(), now), true);
  for (const date of ["invalid", new Date(now + 1).toISOString(), new Date(now - 7 * 86400000).toISOString()]) assert.equal(isRecentBoardPost(date, now), false);
});

test("Board plain-text links preserve content and only produce HTTP(S) hrefs", () => {
  const text = '첫 줄 https://example.com/path?q=1.\n<script>alert(1)</script> javascript:alert(1) https://example.org/a).';
  const parts = boardTextParts(text);
  assert.equal(parts.map(part => part.text).join(""), text);
  assert.equal(parts.filter(part => part.href).length, 2);
  for (const part of parts.filter(part => part.href)) assert(["http:", "https:"].includes(new URL(part.href).protocol));
  assert.equal(boardTextParts("javascript:alert(1)")[0].href, undefined);
  assert.equal(boardTextParts("http://")[0].href, undefined);
});
