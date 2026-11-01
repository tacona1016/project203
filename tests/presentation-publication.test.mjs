import { test } from "node:test";
import assert from "node:assert/strict";
import { getCurrentQuarter, getPublishedQuarters, getLatestPresentation, getQuarterChoices, isPresentationPublished, quarters } from "../data/quarters.ts";
import { findPresentationIssues, checkPresentations } from "../scripts/check-presentations.mjs";
import { parsePollInput, getQuarterPolls } from "../lib/polls.ts";

const q4 = { slug: "2026-q4", year: 2026, quarter: 4, title: "Fixture Q4", description: "Fixture", publishedAt: "2026-10-19", presentationPublished: true };
const q1 = { slug: "2027-q1", year: 2027, quarter: 1, title: "Fixture Q1", description: "Fixture", publishedAt: "2027-01-01", presentationPublished: false };

test("a registered unpublished quarter is Current for Polls/Admin without becoming a presentation link", () => {
  const entries = [q4, q1];
  assert.equal(getCurrentQuarter(entries).slug, "2027-q1");
  assert.deepEqual(getQuarterChoices(entries), [{ slug: "2027-q1", label: "2027 Q1", current: true }, { slug: "2026-q4", label: "2026 Q4", current: false }]);
  assert.equal(getLatestPresentation(entries).slug, "2026-q4");
  assert.deepEqual(getPublishedQuarters(entries).map(q => q.slug), ["2026-q4"]);
  assert.equal(isPresentationPublished("2027-q1", entries), false);
  assert.equal(isPresentationPublished("unknown", entries), false);
  assert.deepEqual(findPresentationIssues(entries, ["2026-q4"]), []);
});

test("publication can be enabled only with a matching MDX route; drafts may already have MDX files", () => {
  assert.deepEqual(findPresentationIssues([q4, q1], ["2026-q4", "2027-q1"]), []);
  const published = { ...q1, presentationPublished: true };
  assert(findPresentationIssues([q4, published], ["2026-q4"]).some(issue => issue.includes("missing page.mdx")));
  assert.deepEqual(findPresentationIssues([q4, published], ["2026-q4", "2027-q1"]), []);
  assert.equal(getLatestPresentation([q4, published]).slug, "2027-q1");
  assert.equal(isPresentationPublished("2027-q1", [q4, published]), true);
  assert.equal(getLatestPresentation([q1]), undefined);
  assert.deepEqual(getPublishedQuarters([]), []);
});

test("unpublished quarters still accept Poll creation and do not decide whether a poll is active", () => {
  const entries = [q4, q1];
  const settings = { quarter: "2027-q1", poll_type: "choice", results_visibility: "live", text_max_length: 1000, title: "Fixture poll", description: "", options: ["One", "Two"], vote_mode: "single", allow_vote_change: false, scheduled: false, is_hidden: false };
  assert.equal(parsePollInput(settings, true, entries).quarter, "2027-q1");
  const catalog = [{ poll: { id: 1, quarter: "2026-q4", created_at: "2026-10-19" }, status: "ACTIVE" }, { poll: { id: 2, quarter: "2027-q1", created_at: "2027-01-01" }, status: "ACTIVE" }];
  assert.equal(getQuarterPolls(catalog, "2027-q1")[0].status, "ACTIVE");
  assert.equal(getQuarterPolls(catalog, "2026-q4")[0].status, "ACTIVE");
});

test("manifest validation rejects duplicates, unsafe slugs and MDX pages without metadata", () => {
  assert(findPresentationIssues([q4, { ...q4 }], ["2026-q4"]).some(issue => issue.includes("Duplicate")));
  assert(findPresentationIssues([{ ...q1, slug: "../outside" }], []).some(issue => issue.includes("Invalid")));
  assert(findPresentationIssues([q4], ["2026-q4", "2027-q1"]).some(issue => issue.includes("no quarter metadata")));
});

test("the existing Q4 presentation stays published and the actual repository manifest is consistent", async () => {
  assert.equal(isPresentationPublished("2026-q4", quarters), true);
  assert.deepEqual(await checkPresentations(), []);
});
