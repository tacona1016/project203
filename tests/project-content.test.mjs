import { test } from "node:test";
import assert from "node:assert/strict";
import { validContentLinks } from "../data/content-links.ts";
import { candidateAmount, candidateSource } from "../data/land-candidates.ts";

test("explicit content links require a registered quarter and safe existing-ID syntax", () => {
  const groups = validContentLinks([{ quarter: "2026-q4", pollSlugs: ["land-priority", "land-priority", "javascript:alert(1)"], decisionPostIds: ["1", "1", "0", "../2"] }, { quarter: "unknown", pollSlugs: ["a"], decisionPostIds: ["2"] }], [{ slug: "2026-q4" }]);
  assert.deepEqual(groups, [{ quarter: "2026-q4", pollSlugs: ["land-priority"], decisionPostIds: ["1"] }]);
});

test("candidate comparisons keep unknown figures unknown and reject unsafe source URLs", () => {
  for (const value of [undefined, NaN, Infinity, -1]) assert.equal(candidateAmount(value, "원"), "미확인");
  assert.equal(candidateAmount(200, "평"), "200평");
  for (const url of [undefined, "javascript:alert(1)", "file:///secret", "/board"]) assert.equal(candidateSource(url), null);
  assert.equal(candidateSource("https://example.com/land"), "https://example.com/land");
});
