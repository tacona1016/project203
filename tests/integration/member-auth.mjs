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
const mapping = { [id(1)]: aPassword, [id(2)]: bPassword, [id(3)]: shared, [id(4)]: shared, [id(5)]: "short" };
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
const body = { title: "Fixture post", content: "Fixture content", post_type: "general", is_pinned: false };
const checks = [];
try {
  for (const port of [3100, 3102, 3103]) { let used = false; try { await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(500) }); used = true; } catch {} assert.equal(used, false, `Port ${port} must be free`); }
  await mkdir(root, { recursive: true });
  for (const name of ["app", "components", "data", "lib", "public", "proxy.ts", "mdx-components.tsx", "next.config.mjs", "tsconfig.json", "package.json", "postcss.config.mjs", "next-env.d.ts"]) await cp(name, path.join(root, name), { recursive: true });
  for (const directory of ["home", "board", "shared"]) await mkdir(path.join(root, "private-assets/site", directory), { recursive: true });
  const config = await readFile(path.join(root, "lib/site-images-config.ts"), "utf8");
  await writeFile(path.join(root, "lib/site-images-config.ts"), config.replace("board/banner.jpg", "board/banner.png"));
  await writeFile(path.join(root, "private-assets/site/board/banner.png"), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64"));
  log = openSync(".verification/member-auth-integration.log", "w");
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
  for (const [person, password] of [[1, "incorrect"], [5, "short"], [6, shared]]) { const r = await anonymous.login(person, password); assert.equal(r.status, 401); assert.equal((await r.json()).error, failure); }
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
  for (const route of ["/", "/archive", "/polls", "/board", "/admin", "/quarter/2026-q4", "/api/site-images/boardBanner"]) { const r = await a.call(route); assert.equal(r.status, 200); assert(r.headers.get("cache-control").includes("no-store")); }
  await expectStatus(a.call("/api/participants/selection", "POST", { participantId: id(2) }), 410);
  await expectStatus(a.call("/api/board/session", "POST", { password: aPassword }), 410);
  for (const target of ["https://outside.invalid", "//outside.invalid", "/%2f%2foutside.invalid", "/api/polls", "/access", "/\\outside.invalid"]) { const r = await b.login(2, bPassword, target); assert.equal((await r.json()).redirectTo, "/"); }
  checks.push("30-day cookie and navigation; private image; no shared/board password step; safe return paths");

  await expectStatus(a.call("/api/polls/changeable/votes", "POST", { optionId: 201, participantId: id(2) }), 400);
  await expectStatus(a.call("/api/comments", "POST", { quarter: "2026-q4", content: "forged", authorId: id(2) }), 400);
  await expectStatus(a.call("/api/polls/changeable/participation?participantId=" + id(2)), 400);
  await expectStatus(a.call("/api/polls/changeable/votes", "POST", { optionId: 201 }), 200);
  await expectStatus(a.call("/api/polls/changeable/votes", "POST", { optionId: 202 }), 200);
  const choice = await (await a.call("/api/polls/changeable/participation")).json(); assert.equal(choice.option_id, 202); assert.equal(choice.vote_count, 1);
  assert.equal((await (await b.call("/api/polls/changeable/participation")).json()).vote_count, 0);
  await expectStatus(a.call("/api/polls/repeat/votes", "POST", { optionId: 301 }), 200); await expectStatus(a.call("/api/polls/repeat/votes", "POST", { optionId: 302 }), 200);
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

  await expectStatus(a.call("/api/admin/polls", "POST", {}), 403);
  await expectStatus(a.call("/api/admin/access", "POST", { password: env.ADMIN_PASSWORD }), 200);
  const settings = { quarter: "2026-q4", title: "Admin fixture poll", description: "Fixture only", poll_type: "choice", results_visibility: "live", text_max_length: 1000, options: ["One", "Two"], vote_mode: "single", allow_vote_change: true, scheduled: false, is_hidden: false };
  const created = await a.call("/api/admin/polls", "POST", settings); assert.equal(created.status, 200); const createdSlug = (await created.json()).slug;
  await expectStatus(a.call(`/api/admin/polls/${createdSlug}`, "PATCH", { ...settings, title: "Edited fixture poll" }), 200);
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
  const sharedA = new Browser(), sharedB = new Browser(); await expectStatus(sharedA.login(3, shared), 200); await expectStatus(sharedB.login(4, shared), 200);
  assert.equal((await (await sharedA.call("/api/access/session")).json()).participant.id, id(3)); assert.equal((await (await sharedB.call("/api/access/session")).json()).participant.id, id(4));
  const expired = new Browser(); expired.cookies.set("project203_member", createMemberToken(secret, id(1), aPassword, Math.floor(Date.now() / 1000) - SESSION_DURATION).token); await expectStatus(expired.call("/api/access/session"), 401);
  await fetch("http://127.0.0.1:3102/_test", { method: "POST", body: JSON.stringify({ changeParticipant: { id: id(1), is_active: false } }) });
  await expectStatus(a.call("/api/access/session"), 401); await expectStatus(a.login(1, aPassword), 401);
  await fetch("http://127.0.0.1:3102/_test", { method: "POST", body: JSON.stringify({ changeParticipant: { id: id(1), is_active: true } }) });
  await expectStatus(a.call("/api/access/lock", "POST"), 200); await expectStatus(a.call("/api/access/session"), 401);
  await expectStatus(a.login(2, bPassword), 200); a.cookies.set("project203_admin", adminProof); await expectStatus(a.call("/api/admin/polls", "POST", {}), 403);
  checks.push("Admin create/edit/close/reopen/hide/unhide; results publication; board comment ownership; both sessions required and cannot transfer; shared passwords; expiry/deactivation/logout");

  if (process.argv.includes("--browser")) { const { runBrowser } = await import("./member-browser.mjs"); await runBrowser({ base, root, aPassword, bPassword, id }); checks.push("Chrome mobile/autofill/Enter/navigation/two-tab logout"); }
  const savedB = new Map(b.cookies);
  await start(JSON.stringify({ ...mapping, [id(2)]: bPassword + "changed" }));
  b.cookies = new Map(savedB); await expectStatus(b.call("/api/access/session"), 401); await expectStatus(b.login(2, bPassword), 401);
  await start("invalid-json"); const bad = await b.login(2, bPassword); assert.equal(bad.status, 401); assert.equal((await bad.json()).error, failure);
  checks.push("Password configuration rotation and invalid JSON reject sessions/login without revealing settings");
  await writeFile(".verification/member-auth-report.json", JSON.stringify({ status: "passed", database: "synthetic HTTP protocol fixtures, not live PostgreSQL", checks }, null, 2));
  console.log(JSON.stringify({ status: "passed", production, checks, database: "local protocol fixtures only" }));
} finally { for (const p of children.reverse()) await stop(p); if (log !== undefined) closeSync(log); }
