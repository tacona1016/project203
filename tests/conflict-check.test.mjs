import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { findConflictMarkers, checkConflicts } from "../scripts/check-conflicts.mjs";

const cli = fileURLToPath(new URL("../scripts/check-conflicts.mjs", import.meta.url));
async function removeTestDirectory(root) {
  const absolute = path.resolve(root);
  assert(absolute.startsWith(`${path.resolve(os.tmpdir())}${path.sep}project203-`));
  await rm(absolute, { recursive: true, force: true });
}

test("conflict check detects standalone, indented, CRLF and diff3 control lines", () => {
  const source = ["export const value = 1;", "<<<<<<< HEAD", "  ||||||| parent", "=======", ">>>>>>> incoming"].join("\r\n");
  assert.deepEqual(findConflictMarkers(source), [2, 3, 4, 5]);
  assert.deepEqual(findConflictMarkers("=======\nexport {}"), [1], "orphan separators fail too");
});

test("quoted markers, regexes and inline test examples are not conflict control lines", () => {
  const code = [
    'const a = "<<<<<<< HEAD";',
    'const b = "=======";',
    'assert.equal(value, ">>>>>>> incoming");',
    '// A marker example: <<<<<<< HEAD',
    'const regex = /^<{7} /;',
    'Markdown uses `<<<<<<< HEAD` as an inline example.',
  ].join("\n");
  assert.deepEqual(findConflictMarkers(code), []);
});

test("source traversal checks nested MDX, docs and SQL while excluding generated outputs", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "project203-conflicts-"));
  try {
    for (const dir of ["app/quarter", "docs", "supabase", ".next/cache", "node_modules/fake", ".verification"]) await mkdir(path.join(root, dir), { recursive: true });
    for (const file of ["app/quarter/page.mdx", "docs/guide.md", "supabase/example.sql", ".next/cache/output.js", "node_modules/fake/index.js", ".verification/test.mjs"])
      await writeFile(path.join(root, file), ["content", "<<<<<<< HEAD"].join("\n"));
    assert.deepEqual(await checkConflicts(root), [
      { file: "app/quarter/page.mdx", line: 2 }, { file: "docs/guide.md", line: 2 }, { file: "supabase/example.sql", line: 2 },
    ]);
  } finally { await removeTestDirectory(root); }
});

test("build preflight CLI fails with a file/line and succeeds after a valid resolution without Git", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "project203-preflight-"));
  try {
    await writeFile(path.join(root, "page.tsx"), ["const value = 1;", "<<<<<<< HEAD"].join("\n"));
    const failed = spawnSync(process.execPath, [cli], { cwd: root, encoding: "utf8" });
    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /page\.tsx:2: unresolved Git conflict marker/);
    await writeFile(path.join(root, "page.tsx"), 'export const markerExample = "<<<<<<< HEAD";\n');
    const passed = spawnSync(process.execPath, [cli], { cwd: root, encoding: "utf8" });
    assert.equal(passed.status, 0);
    assert.match(passed.stdout, /No Git conflict markers/);
  } finally { await removeTestDirectory(root); }
});
