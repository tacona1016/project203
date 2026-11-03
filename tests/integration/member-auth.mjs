// Real Next.js HTTP boundary, synthetic local Supabase protocol fixtures only.
import assert from "node:assert/strict";
import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { openSync, closeSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { createMemberToken } from "../../lib/auth/member-token.ts";
import { signSession, SESSION_DURATION } from "../../lib/auth/token.ts";

const base = "http://127.0.0.1:3100", root = path.resolve(".verification/member-auth-app");
const production = process.argv.includes("--production");
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const secret = "fixture-only-member-signing-key-with-at-least-32-bytes";
const aPassword = '  fixture-A-$!#"\\-password  ', bPassword = "fixture-B-distinct-password", shared = "fixture-shared-password";
const mapping = { [id(1)]: aPassword, [id(2)]: bPassword, [id(3)]: shared, [id(4)]: shared, [id(5)]: "1", [id(6)]: "", [id(8)]: "x".repeat(2048) };
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3103", SUPABASE_SECRET_KEY: "fixture-only-backend-key",
  SITE_SESSION_SECRET: secret, BOARD_PARTICIPANT_PASSWORDS: JSON.stringify(mapping), ADMIN_PASSWORD: "fixture-only-admin-password" };
delete env.SITE_ACCESS_PASSWORD;
const children = [], pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let app, log;
function child(args, options = {}) { const p = spawn(process.execPath, args, { env, windowsHide: true, stdio: ["ignore", log, log], ...options }); children.push(p); return p; }
async function stop(p) { if (p && p.exitCode === null) { p.kill(); await Promise.race([new Promise(r => p.once("exit", r)), pause(3000)]); } }
async function ready(url) { for (let i = 0; i < 100; i++) { try { if ((await fetch(url)).ok) return; } catch {} await pause(250); } throw Error("Local fixture did not start"); }
async function start(raw = JSON.stringify(mapping)) {
  await stop(app);
  app = child([path.resolve("node_modules/next/dist/bin/next"), production ? "start" : "dev", "--port", "3100", "--hostname", "127.0.0.1"], { cwd: root, env: { ...env, BOARD_PARTICIPANT_PASSWORDS: raw } });
  await ready(base + "/api/access/participants");
}
class Browser {
  cookies = new Map();
  async call(route, method = "GET", body, origin = base) {
    const response = await fetch(base + route, { method, redirect: "manual", headers: { Origin: origin,
      Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    for (const value of response.headers.getSetCookie()) { const pair = value.split(";")[0], index = pair.indexOf("="); this.cookies.set(pair.slice(0, index), pair.slice(index + 1)); }
    return response;
  }
  async login(person, password, next = "/") { return this.call("/api/access", "POST", { participantId: id(person), password, next }); }
}
async function expectStatus(response, code) { assert.equal((await response).status, code); }
async function setDbFailure(mode, after = 0) {
  await fetch("http://127.0.0.1:3102/_test", { method: "POST", body: JSON.stringify({ participantFailure: mode, participantFailureAfter: after }) });
}
const body = { title: "Fixture post", content: "Fixture content", post_type: "general", is_pinned: false };
const checks = [];
try {
  for (const port of [3100, 3102, 3103]) { let used = false; try { await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(500) }); used = true; } catch {} assert.equal(used, false, `Port ${port} must be free`); }
  await mkdir(root, { recursive: true });
  for (const name of ["app", "components", "data", "lib", "public", "scripts", "proxy.ts", "mdx-components.tsx", "next.config.mjs", "tsconfig.json", "package.json", "postcss.config.mjs", "next-env.d.ts"]) await cp(name, path.join(root, name), { recursive: true });
  // Registry-only and draft-MDX quarters exist only in this isolated test copy.
  const registryFile = path.join(root, "data/quarters.ts");
  const registered = [
    { slug: "2027-q1", year: 2027, quarter: 1, title: "Fixture unpublished quarter", description: "Fixture", publishedAt: "2027-01-01", presentationPublished: false },
    { slug: "2026-q3", year: 2026, quarter: 3, title: "Fixture draft", description: "Fixture", publishedAt: "2026-07-01", presentationPublished: false },
  ];
  const registry = (await readFile(registryFile, "utf8")).replace("export const quarters: readonly Quarter[] = [", `export const quarters: readonly Quarter[] = [\n${registered.map(q => JSON.stringify(q)).join(",\n")},`);
  await writeFile(registryFile, registry);
  const linkFile = path.join(root, "data/content-links.ts");
  await writeFile(linkFile, (await readFile(linkFile, "utf8")).replace("export const contentLinks: readonly ContentLinkGroup[] = [];", 'export const contentLinks: readonly ContentLinkGroup[] = [{quarter:"2026-q4",pollSlugs:["land-priority","hidden","missing"],decisionPostIds:["90","1","999"]}];'));
  const candidateFile = path.join(root, "data/land-candidates.ts");
  const candidateFixtures = ["A", "B"].map(key => ({ id: `fixture-${key}`, name: `합성 후보 ${key}`, location: "테스트 전용 가상 위치", areaPyeong: 200, access: "미확인", buildability: "미확인", road: "미확인", utilities: "미확인", terrain: "미확인", surroundings: "미확인", extraCosts: "미확인", needsVerification: "실제 후보지가 아닌 테스트 자료" }));
  await writeFile(candidateFile, (await readFile(candidateFile, "utf8")).replace("export const landCandidates: readonly LandCandidate[] = [];", `export const landCandidates: readonly LandCandidate[] = ${JSON.stringify(candidateFixtures)};`));
  await mkdir(path.join(root, "app/quarter/2026-q3"), { recursive: true });
  await writeFile(path.join(root, "app/quarter/2026-q3/page.mdx"), 'import { getQuarter } from "@/data/quarters";\n\n<Presentation quarter={getQuarter("2026-q3")}><h1>fixture-unpublished-mdx-must-stay-private</h1></Presentation>\n');
  for (const directory of ["home", "board", "shared"]) await mkdir(path.join(root, "private-assets/site", directory), { recursive: true });
  const config = await readFile(path.join(root, "lib/site-images-config.ts"), "utf8");
  await writeFile(path.join(root, "lib/site-images-config.ts"), config.replace("board/banner.jpg", "board/banner.png"));
  await writeFile(path.join(root, "private-assets/site/board/banner.png"), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64"));
  log = openSync(".verification/member-auth-integration.log", "w");
  async function validateManifest(expectedCode) {
    const validator = child(["--experimental-strip-types", path.join(root, "scripts/check-presentations.mjs")], { cwd: root });
    assert.equal(await new Promise(resolve => validator.once("exit", resolve)), expectedCode, "Presentation manifest CLI status");
  }
  await validateManifest(0);
  await writeFile(registryFile, registry.replace(JSON.stringify(registered[0]), JSON.stringify({ ...registered[0], presentationPublished: true })));
  await validateManifest(1); // Published metadata cannot point at a missing MDX file.
  await writeFile(registryFile, registry);
  if (production) {
    const build = child([path.resolve("node_modules/next/dist/bin/next"), "build"], { cwd: root });
    assert.equal(await new Promise(r => build.once("exit", r)), 0, "Fixture production build");
    const directory = path.join(root, ".next/static");
    for (const file of await readdir(directory, { recursive: true })) if (file.endsWith(".js")) {
      const source = await readFile(path.join(directory, file), "utf8");
      for (const canary of [secret, aPassword, bPassword, shared, env.ADMIN_PASSWORD, env.SUPABASE_SECRET_KEY]) assert.equal(source.includes(canary), false, "Server secret canary must not appear in a browser chunk");
    }
  }
  child(["tests/fixtures/polls-server.mjs"]); child(["tests/fixtures/board-server.mjs"]);
  await ready("http://127.0.0.1:3102/_test"); await ready("http://127.0.0.1:3103/_test"); await start();
  const anonymous = new Browser();
  for (const route of ["/", "/archive", "/polls", "/board", "/admin", "/quarter/2026-q4", "/future-page"]) {
    const response = await anonymous.call(route); assert.equal(response.status, 307); assert.equal(new URL(response.headers.get("location"), base).pathname, "/access");
  }
  for (const route of ["/api/polls", "/api/comments?quarter=2026-q4", "/api/participants", "/api/board/session", "/api/access/session", "/api/site-images/boardBanner"]) await expectStatus(anonymous.call(route), 401);
  const names = await (await anonymous.call("/api/access/participants")).json();
  assert(names.length > 0 && names.every(p => Object.keys(p).sort().join(",") === "display_name,id"));
  const failure = "이름과 비밀번호를 확인해주세요.";
  for (const [person, password] of [[1, "incorrect"], [6, ""], [7, shared]]) { const r = await anonymous.login(person, password); assert.equal(r.status, 401); assert.equal((await r.json()).error, failure); }
  const unrestricted = new Browser();
  await expectStatus(unrestricted.login(5, "1"), 200);
  await expectStatus(unrestricted.login(8, "x".repeat(2048)), 200);
  await expectStatus(anonymous.login(1, aPassword.trim()), 401);
  await expectStatus(anonymous.call("/api/access", "POST", { participantId: id(1), password: aPassword }, "https://cross-site.invalid"), 403);
  const legacy = new Browser(); legacy.cookies.set("project203_access", signSession(secret).token); legacy.cookies.set("project203_participant_selection", id(1)); legacy.cookies.set("project203_board", signSession(secret).token);
  await expectStatus(legacy.call("/api/access/session"), 401);
  checks.push("Anonymous pages/APIs/images blocked; minimal public directory; uniform failure; exact strings; same-origin; legacy cookies rejected");

  const a = new Browser(), b = new Browser();
  const login = await a.login(1, aPassword, "/quarter/2026-q4?from=login"); assert.equal(login.status, 200); assert.equal((await login.json()).redirectTo, "/quarter/2026-q4?from=login");
  const issued = login.headers.getSetCookie().find(c => c.startsWith("project203_member="));
  assert(issued.includes("HttpOnly") && issued.includes("SameSite=lax") && issued.includes("Max-Age=2592000"));
  if (production) assert(issued.includes("Secure"));
  assert.equal((await (await a.call("/api/access/session")).json()).participant.id, id(1));
  await expectStatus(b.login(2, bPassword), 200);
  const { runPollParticipationChecks } = await import("./poll-participation.mjs");
  checks.push(...await runPollParticipationChecks({ a, b, anonymous, id }));
  const home = await (await a.call("/")).text(), archive = await (await a.call("/archive")).text();
  for (const html of [home, archive]) {
    assert(html.includes("/quarter/2026-q4"));
    assert.equal(html.includes("/quarter/2027-q1"), false);
    assert.equal(html.includes("/quarter/2026-q3"), false);
  }
  assert(home.includes("현재 단계와 다음 행동은 논의 후 업데이트합니다."));
  for (const slug of ["2027-q1", "2026-q3"]) {
    const draft = await a.call(`/quarter/${slug}`); assert.equal(draft.status, 404);
    assert.equal((await draft.text()).includes("fixture-unpublished-mdx-must-stay-private"), false);
  }
  const quarterPolls = await a.call("/polls/2027-q1"); assert.equal(quarterPolls.status, 200); assert((await quarterPolls.text()).includes("Current poll"));
  checks.push("Published Q4 stays linked; registry-only/draft presentations stay hidden and return 404; unpublished quarters still show their Polls; Home status is explicitly undecided");
  for (const route of ["/", "/archive", "/polls", "/board", "/admin", "/quarter/2026-q4", "/api/site-images/boardBanner"]) { const r = await a.call(route); assert.equal(r.status, 200); assert(r.headers.get("cache-control").includes("no-store")); }
  await expectStatus(a.call("/api/participants/selection", "POST", { participantId: id(2) }), 410);
  await expectStatus(a.call("/api/board/session", "POST", { password: aPassword }), 410);
  for (const target of ["https://outside.invalid", "//outside.invalid", "/%2f%2foutside.invalid", "/api/polls", "/access", "/\\outside.invalid"]) { const r = await b.login(2, bPassword, target); assert.equal((await r.json()).redirectTo, "/"); }
  checks.push("30-day cookie and navigation; private image; no shared/board password step; safe return paths");

  const memberCookie = a.cookies.get("project203_member");
  for (const mode of ["connection", "timeout", "database", "internal"]) {
    await setDbFailure(mode);
    try {
      const loginFailure = await anonymous.login(1, aPassword);
      assert.equal(loginFailure.status, 503, `${mode}: login service status`);
      assert.equal((await loginFailure.json()).code, "service_unavailable");
      const attempts = await (await fetch("http://127.0.0.1:3102/_test")).json();
      assert.equal(attempts.participantRequestCount, 1, "Authentication lookup must not silently repeat a failed DB request");
      assert.equal(loginFailure.headers.has("set-cookie"), false);
      const loginPage = await anonymous.call("/access"); assert.equal(loginPage.status, 503);
      assert.equal(loginPage.headers.has("location"), false);
      for (const route of ["/api/access/session", "/api/polls", "/api/site-images/boardBanner"]) {
        const failure = await a.call(route); assert.equal(failure.status, 503, `${mode}: protected request`);
        assert.equal(failure.headers.has("location"), false); assert.equal(failure.headers.has("set-cookie"), false);
        assert(failure.headers.get("cache-control").includes("no-store"));
      }
      for (const route of ["/", "/quarter/2026-q4"]) {
        const failure = await a.call(route); assert.equal(failure.status, 503);
        assert.equal(failure.headers.has("location"), false); assert.equal(failure.headers.has("set-cookie"), false);
        assert.equal(failure.headers.get("retry-after"), "30");
        const text = await failure.text();
        for (const marker of ["fixture-upstream-sensitive-detail", "private-fixture-response-A", "머무를 집에서", aPassword, secret]) assert.equal(text.includes(marker), false);
      }
      assert.equal(a.cookies.get("project203_member") === memberCookie, true);
    } finally { await setDbFailure(null); }
    await expectStatus(a.call("/api/access/session"), 200);
    await expectStatus(a.call("/quarter/2026-q4"), 200);
  }
  await setDbFailure("delayed");
  try {
    const timedOut = await anonymous.login(1, aPassword); assert.equal(timedOut.status, 503);
    assert.equal((await timedOut.json()).code, "service_unavailable");
    const attempts = await (await fetch("http://127.0.0.1:3102/_test")).json();
    assert.equal(attempts.participantRequestCount, 1, "The real fetch timeout must not retry the timed-out lookup");
  } finally { await setDbFailure(null); }
  // Simulate a failure after Proxy has already verified membership.
  await setDbFailure("timeout", 1);
  try {
    const lateApiFailure = await a.call("/api/access/session"); assert.equal(lateApiFailure.status, 503);
    assert.equal(lateApiFailure.headers.get("retry-after"), "30");
  } finally { await setDbFailure(null); }
  await setDbFailure("timeout", 1);
  try {
    const lateImageFailure = await a.call("/api/site-images/boardBanner");
    assert.equal(lateImageFailure.status, 503);
    assert.equal(lateImageFailure.headers.get("retry-after"), "30");
    assert.equal(lateImageFailure.headers.has("set-cookie"), false);
    assert.equal((await lateImageFailure.arrayBuffer()).byteLength, 0);
  } finally { await setDbFailure(null); }
  await setDbFailure("timeout", 1);
  try {
    const latePageFailure = await a.call("/quarter/2026-q4");
    assert.equal(latePageFailure.headers.has("location"), false);
    const html = await latePageFailure.text();
    assert(html.includes("서비스 연결에 문제가 있습니다."));
    assert.equal(html.includes("머무를 집에서"), false);
    assert.equal(a.cookies.get("project203_member") === memberCookie, true);
  } finally { await setDbFailure(null); }
  await expectStatus(a.call("/quarter/2026-q4"), 200);
  checks.push("Connection/timeout/database/malformed-upstream failures return safe 503 without redirect or cookie deletion; one DB attempt including the real 10s timeout; original session recovers without re-login");

  await expectStatus(a.call("/api/polls/changeable/votes", "POST", { optionId: 201, participantId: id(2) }), 400);
  await expectStatus(a.call("/api/comments", "POST", { quarter: "2026-q4", content: "forged", authorId: id(2) }), 400);
  await expectStatus(a.call("/api/polls/changeable/participation?participantId=" + id(2)), 400);
  await expectStatus(a.call("/api/polls/changeable/votes", "POST", { optionId: 201 }), 200);
  await expectStatus(a.call("/api/polls/changeable/votes", "POST", { optionId: 202 }), 200);
  const choice = await (await a.call("/api/polls/changeable/participation")).json(); assert.equal(choice.option_id, 202); assert.equal(choice.vote_count, 1);
  assert.equal((await (await b.call("/api/polls/changeable/participation")).json()).vote_count, 0);
  await expectStatus(a.call("/api/polls/repeat/votes", "POST", { optionIds: [301, 302, 303] }), 200);
  assert.equal(await (await a.call("/api/polls/repeat/votes", "POST", { optionIds: [301] })).json(), "already_voted");
  assert.equal(await (await a.call("/api/polls/land-priority/votes", "POST", { optionId: 102 })).json(), "already_voted");
  assert.equal(await (await a.call("/api/polls/upcoming/votes", "POST", { optionId: 401 })).json(), "poll_upcoming");
  assert.equal(await (await a.call("/api/polls/closed/votes", "POST", { optionId: 501 })).json(), "poll_closed");
  await expectStatus(a.call("/api/polls/text-fixed/votes", "POST", { textResponse: "x".repeat(1001) }), 400);
  await expectStatus(a.call("/api/polls/text-fixed/votes", "POST", { textResponse: "   " }), 400);
  await expectStatus(a.call("/api/polls/text-private/votes", "POST", { textResponse: "private-fixture-response-A" }), 200);
  const own = await (await a.call("/api/polls/text-private/participation")).json(); assert.equal(own.text_response, "private-fixture-response-A");
  assert.equal((await (await b.call("/api/polls/text-private/participation")).json()).text_response, null);
  const hidden = await (await b.call("/api/polls/text-private/results")).json(); assert.equal(hidden.results, null); assert.equal(hidden.responses, null);
  const html = await (await b.call("/polls/text-private")).text(); assert.equal(html.includes("private-fixture-response-A"), false);
  const comment = await (await a.call("/api/comments", "POST", { quarter: "2026-q4", content: "session-authored comment" })).json(); assert.equal(comment.participant_id, id(1));
  const posted = await (await a.call("/api/board/posts", "POST", body)).json();
  const post = await (await a.call(`/api/board/posts/${posted.id}`)).json(); assert.equal(post.author_id, id(1));
  const boardComment = await (await a.call(`/api/board/posts/${posted.id}/comments`, "POST", { content: "own fixture comment" })).json();
  await expectStatus(b.call(`/api/board/posts/${posted.id}/comments/${boardComment.id}`, "DELETE"), 403);
  await expectStatus(a.call(`/api/board/posts/${posted.id}/comments/${boardComment.id}`, "DELETE"), 200);
  await expectStatus(b.call(`/api/board/posts/${posted.id}`, "PATCH", body), 403);
  await expectStatus(b.call(`/api/board/posts/${posted.id}`, "DELETE"), 403);
  await expectStatus(a.call("/api/board/posts", "POST", { ...body, post_type: "notice" }), 403);
  await expectStatus(a.call("/api/board/posts", "POST", { ...body, author_id: id(2) }), 400);
  checks.push("Session-only authorship; choice change/repeat; own text response only; hidden results absent in API/HTML/RSC; board ownership and notices");
  const { runChoiceBallotChecks } = await import("./choice-ballots.mjs");
  checks.push(...await runChoiceBallotChecks({ a, b, anonymous, id }));

  await expectStatus(a.call("/api/admin/polls", "POST", {}), 403);
  await expectStatus(a.call("/api/admin/access", "POST", { password: env.ADMIN_PASSWORD }), 200);
  const createMarkup = await (await a.call("/admin/polls/new")).text();
  assert(createMarkup.includes('method="post"'));
  assert(createMarkup.includes('<fieldset disabled=""'), "The server-rendered Admin form must wait for hydration");
  const settings = { quarter: "2026-q4", title: "Admin fixture poll", description: "Fixture only", poll_type: "choice", results_visibility: "live", text_max_length: 1000, options: ["One", "Two"], vote_mode: "single", allow_vote_change: true, scheduled: false, is_hidden: false };
  const created = await a.call("/api/admin/polls", "POST", settings); assert.equal(created.status, 200); const createdSlug = (await created.json()).slug;
  await expectStatus(a.call(`/api/admin/polls/${createdSlug}`, "PATCH", { ...settings, title: "Edited fixture poll" }), 200);
  const multipleSettings = { ...settings, title: "Canonical choices settings", vote_mode: "multiple", options: [] };
  for (const invalid of [{ quarter: "2027-q1" }, { vote_mode: "single" }, { options: ["changed", "options"] }]) await expectStatus(a.call("/api/admin/polls/multi-edit", "PATCH", { ...multipleSettings, ...invalid }), 409);
  await expectStatus(a.call("/api/admin/polls/multi-edit", "PATCH", { ...multipleSettings, allow_vote_change: false }), 200);
  const lockedMultiple = await (await a.call("/api/admin/polls/multi-edit")).json(); assert.equal(lockedMultiple.poll.allow_vote_change, false);
  await expectStatus(a.call("/api/admin/polls/multi-edit", "PATCH", multipleSettings), 200);
  await expectStatus(a.call("/api/admin/polls/text-private/state", "POST", { action: "close" }), 200);
  assert.notEqual((await (await b.call("/api/polls/text-private/results")).json()).responses, null);
  await expectStatus(a.call("/api/admin/polls/text-private/state", "POST", { action: "reopen" }), 200);
  assert.equal((await (await b.call("/api/polls/text-private/results")).json()).responses, null);
  await expectStatus(a.call("/api/admin/polls/text-private/state", "POST", { action: "hide" }), 200);
  await expectStatus(b.call("/api/polls/text-private"), 404);
  await expectStatus(a.call("/api/admin/polls/text-private"), 200);
  await expectStatus(a.call("/api/admin/polls/text-private/state", "POST", { action: "unhide" }), 200);
  const adminProof = a.cookies.get("project203_admin"); b.cookies.set("project203_admin", adminProof);
  await expectStatus(b.call("/api/admin/polls", "POST", {}), 403);
  await expectStatus(a.call("/api/board/posts", "POST", { ...body, post_type: "notice", is_pinned: true }), 200);
  const { runWebsiteFeatureChecks } = await import("./website-features.mjs");
  checks.push(...await runWebsiteFeatureChecks({ a, b, anonymous, id, adminPassword: env.ADMIN_PASSWORD }));
  const { runBoardEngagementChecks } = await import("./board-engagement.mjs");
  checks.push(...await runBoardEngagementChecks({ a, b, anonymous, id, adminPassword: env.ADMIN_PASSWORD }));
  const sharedA = new Browser(), sharedB = new Browser(); await expectStatus(sharedA.login(3, shared), 200); await expectStatus(sharedB.login(4, shared), 200);
  assert.equal((await (await sharedA.call("/api/access/session")).json()).participant.id, id(3)); assert.equal((await (await sharedB.call("/api/access/session")).json()).participant.id, id(4));
  const expired = new Browser(); expired.cookies.set("project203_member", createMemberToken(secret, id(1), aPassword, Math.floor(Date.now() / 1000) - SESSION_DURATION).token); await expectStatus(expired.call("/api/access/session"), 401);
  await fetch("http://127.0.0.1:3102/_test", { method: "POST", body: JSON.stringify({ changeParticipant: { id: id(1), is_active: false } }) });
  await expectStatus(a.call("/api/access/session"), 401); await expectStatus(a.login(1, aPassword), 401);
  await fetch("http://127.0.0.1:3102/_test", { method: "POST", body: JSON.stringify({ changeParticipant: { id: id(1), is_active: true } }) });
  await expectStatus(a.call("/api/access/lock", "POST"), 200); await expectStatus(a.call("/api/access/session"), 401);
  await expectStatus(a.login(2, bPassword), 200); a.cookies.set("project203_admin", adminProof); await expectStatus(a.call("/api/admin/polls", "POST", {}), 403);
  checks.push("Admin create/edit/close/reopen/hide/unhide; results publication; board comment ownership; both sessions required and cannot transfer; shared passwords; expiry/deactivation/logout");

  if (process.argv.includes("--browser")) { const { runBrowser } = await import("./member-browser.mjs"); await runBrowser({ base, root, aPassword, bPassword, id, setDbFailure, adminPassword: env.ADMIN_PASSWORD }); checks.push("Chrome mobile/autofill/Enter/navigation/two-tab logout, DB recovery, checkbox/change/success/uncertain feedback and Admin GUI settings"); }
  if (!production) {
    await writeFile(registryFile, registry.replace(JSON.stringify(registered[1]), JSON.stringify({ ...registered[1], presentationPublished: true })));
    await start();
    await expectStatus(b.call("/quarter/2026-q3"), 200);
    assert((await (await b.call("/archive")).text()).includes("/quarter/2026-q3"));
    await writeFile(registryFile, registry); await start();
    await expectStatus(b.call("/quarter/2026-q3"), 404);
    checks.push("Existing draft MDX publication on/off controls both direct access and Archive without changing Poll quarter membership");
  }
  const savedB = new Map(b.cookies);
  await start(JSON.stringify({ ...mapping, [id(2)]: bPassword + "changed" }));
  b.cookies = new Map(savedB); await expectStatus(b.call("/api/access/session"), 401); await expectStatus(b.login(2, bPassword), 401);
  await start("invalid-json"); const bad = await b.login(2, bPassword); assert.equal(bad.status, 401); assert.equal((await bad.json()).error, failure);
  checks.push("Password configuration rotation and invalid JSON reject sessions/login without revealing settings");
  await writeFile(".verification/member-auth-report.json", JSON.stringify({ status: "passed", database: "synthetic HTTP protocol fixtures, not live PostgreSQL", checks }, null, 2));
  console.log(JSON.stringify({ status: "passed", production, checks, database: "local protocol fixtures only" }));
} finally { for (const p of children.reverse()) await stop(p); if (log !== undefined) closeSync(log); }
