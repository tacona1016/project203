import { test } from "node:test";
import assert from "node:assert/strict";
import { boardInput, boardCommentInput, boardPage, boardSearch, canManageBoardPost } from "../lib/board/validation.ts";
import { boardSigningKey, configuredBoardPassword, boardPasswordIssue } from "../lib/auth/board-token.ts";
import { signSession, verifySession, SESSION_DURATION } from "../lib/auth/token.ts";
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
test("a freely chosen name cannot manage another author's post or a notice", () => {
  const post = { author_id: "a", post_type: "general" };
  assert.equal(canManageBoardPost(post, { participantId: "a", verified: false, isAdmin: false }), false);
  assert.equal(canManageBoardPost(post, { participantId: "b", verified: true, isAdmin: false }), false);
  assert.equal(canManageBoardPost(post, { participantId: "a", verified: true, isAdmin: false }), true);
  assert.equal(canManageBoardPost({ ...post, post_type: "notice" }, { participantId: "a", verified: true, isAdmin: false }), false);
  assert.equal(canManageBoardPost({ ...post, post_type: "notice" }, { participantId: "b", verified: false, isAdmin: true }), true);
});
test("board proof is bound to person, site cookie and individual password with 30-day signed expiry", () => {
  const secret = "fixture-only-32-byte-session-secret", password = "fixture-person-a-password", now = 10000;
  const key = boardSigningKey(secret, "a", password, "site-cookie-a");
  const { token } = signSession(key, now);
  assert(verifySession(token, key, now + SESSION_DURATION - 1));
  assert.equal(verifySession(token, key, now + SESSION_DURATION), null);
  for (const otherKey of [boardSigningKey(secret, "b", password, "site-cookie-a"), boardSigningKey(secret, "a", password, "other-site"), boardSigningKey(secret, "a", "different-password", "site-cookie-a"), secret]) assert.equal(verifySession(token, otherKey, now), null);
  assert.equal(boardSigningKey("short", "a", password, "site"), "");
  assert.equal(configuredBoardPassword(JSON.stringify({ a: password }), "a"), password);
  for (const raw of [undefined, "invalid-json", "[]", JSON.stringify({ a: "short" }), JSON.stringify({ a: "          " })]) assert.equal(configuredBoardPassword(raw, "a"), null);
});
test("private image keys and byte signatures reject paths, SVG, HTML and renamed content", () => {
  assert.equal(siteImagePath("boardBanner"), "board/banner.jpg");
  for (const key of ["../.env.local", "home/hero.jpg", "__proto__", "constructor", "boardBanner%00.jpg", "%2e%2e", "/boardBanner"]) assert.equal(siteImagePath(key), null);
  assert.equal(siteImageContentType("a.jpg", Buffer.from([255,216,255,0])), "image/jpeg");
  assert.equal(siteImageContentType("a.png", Buffer.from([137,80,78,71,13,10,26,10])), "image/png");
  for (const [file, content] of [["a.jpg", "<html>"], ["a.svg", "<svg/>"], ["a.jpg", "GIF89a"], ["a.png", "<script>"], ["a.webp", "RIFF1234HTML"]]) assert.equal(siteImageContentType(file, Buffer.from(content)), null);
});

test("board configuration reports a non-secret reason while invalid passwords remain denied", () => {
  const password = "fixture-person-only-password";
  const cases = [
    [undefined, "not_configured"],
    ["not-json", "invalid_json"],
    ["[]", "invalid_json"],
    ["{}", "missing_participant"],
    [JSON.stringify({ a: "short" }), "invalid_length"],
    [JSON.stringify({ a: " " + password }), "whitespace"],
  ];
  for (const [raw, issue] of cases) {
    assert.equal(boardPasswordIssue(raw, "a"), issue);
    assert.equal(configuredBoardPassword(raw, "a"), null);
    assert(!boardPasswordIssue(raw, "a").includes(password));
  }
  const valid = JSON.stringify({ a: password, b: "fixture-another-person-password" });
  assert.equal(boardPasswordIssue(valid, "a"), null);
  assert.equal(configuredBoardPassword(valid, "a"), password);
});

test("participants may share a password while their existing signed proofs remain separate", () => {
  const password = "fixture-shared-board-password";
  const raw = JSON.stringify({ a: password, b: password });
  for (const id of ["a", "b"]) {
    assert.equal(boardPasswordIssue(raw, id), null);
    assert.equal(configuredBoardPassword(raw, id), password);
  }
  assert.equal(configuredBoardPassword(raw, "missing"), null);
  const secret = "fixture-only-32-byte-session-secret", access = "fixture-site-token", now = 10000;
  const aKey = boardSigningKey(secret, "a", password, access);
  const bKey = boardSigningKey(secret, "b", password, access);
  assert.notEqual(aKey, bKey);
  const { token } = signSession(aKey, now);
  assert(verifySession(token, aKey, now));
  assert.equal(verifySession(token, bKey, now), null);
});
