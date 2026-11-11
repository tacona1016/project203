import assert from "node:assert/strict";
import { test } from "node:test";
import { parseProjectCommand, projectData, projectDate, missingProjectSchema } from "../lib/project/model.ts";
import { getUpcomingProjectEvents } from "../data/project-plan.ts";

const status = { phase: "검토 단계", goal: "합성 목표", nextAction: "합성 다음 행동", updatedAt: "2026-11-11", relatedLinks: [{ label: "발표", href: "/quarter/2026-q4" }] };
test("A saved event with no optional link stays visible in Home", () => {
  const event = { ...projectData("event", { title: "TEST event", startsAt: "2099-01-01T10:30:00+09:00", isVisible: true }), id: "00000000-0000-4000-8000-000000000911" };
  assert.equal(event.href, null);
  assert.equal(getUpcomingProjectEvents([event]).length, 1);
  assert.equal(getUpcomingProjectEvents([{ ...event, href: "//outside.invalid" }]).length, 0);
});
test("Project status validates confirmed dates, bounded text, internal links and rejects supplied identity", () => {
  assert.deepEqual(parseProjectCommand({ kind: "status", action: "save", version: 0, data: status }).data, status);
  assert.equal(projectData("status", null), null);
  for (const change of [{ updatedAt: "2026-02-30" }, { phase: "" }, { nextAction: "가".repeat(1001) }, { relatedLinks: [{ label: "x", href: "//outside.invalid" }] }]) assert.throws(() => projectData("status", { ...status, ...change }));
  assert.throws(() => parseProjectCommand({ kind: "status", action: "save", version: 0, data: status, authorId: "forged" }));
});
test("Project events require explicit timezone, preserve Seoul instant, reject bad dates and unsafe links", () => {
  const d = { title: "모임", startsAt: "2027-01-03T09:00:00+09:00", isVisible: true };
  assert.equal(projectData("event", d).startsAt, "2027-01-03T00:00:00.000Z");
  for (const change of [{ startsAt: "2027-01-03T09:00" }, { startsAt: "2026-02-30T09:00:00Z" }, { href: "/board/%5c%5coutside" }, { isVisible: "true" }]) assert.throws(() => projectData("event", { ...d, ...change }));
});
test("Explicit decisions preserve bigint IDs, deduplicate Polls and never infer confirmation from a title", () => {
  const d = { decidedOn: null, relatedPollSlugs: ["a-poll", "a-poll"], isVisible: true, supersededBy: "90071992547409932" };
  const cmd = parseProjectCommand({ kind: "decision", action: "save", id: "90071992547409931", version: 1, data: d });
  assert.equal(cmd.id, "90071992547409931"); assert.deepEqual(cmd.data.relatedPollSlugs, ["a-poll"]);
  for (const change of [{ title: "결정" }, { relatedPollSlugs: ["x);drop table"] }, { decidedOn: "2026-13-01" }]) assert.throws(() => projectData("decision", { ...d, ...change }));
});
test("CAS/revision commands cannot delete decisions, omit keys or forge versions", () => {
  assert.throws(() => parseProjectCommand({ kind: "decision", action: "delete", id: "1", version: 1 }));
  assert.throws(() => parseProjectCommand({ kind: "event", action: "restore", version: 1, historyId: "1" }));
  assert.throws(() => parseProjectCommand({ kind: "status", action: "save", version: -1, data: null }));
  assert.equal(parseProjectCommand({ kind: "status", action: "restore", id: "current", version: 1, historyId: "7" }).historyId, "7");
});
test("Only an absent known management RPC activates legacy fallback, never DB outages or permissions", () => {
  assert(missingProjectSchema({ code: "PGRST202", message: "Could not find public.get_project_home" }));
  assert(!missingProjectSchema({ code: "PGRST202", message: "Unknown unrelated RPC" }));
  for (const code of ["XX000", "42501", "57014", "42P01"]) assert(!missingProjectSchema({ code, message: "get_project_home" }));
  assert.equal(projectDate(""), null);
});
