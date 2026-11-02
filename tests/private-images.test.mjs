import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, readFile, writeFile, open, symlink, rmdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const execute = promisify(execFile);
// Synthetic 1x1 grayscale JPEG. No repository photos or production files are read.
const jpeg = Buffer.from("/9j/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAALCAABAAEBAREA/8QAJgABAAAAAAAAAAAAAAAAAAAAABABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAAPwA//9k=", "base64");

async function withImageFixture(operation) {
  const prefix = path.join(tmpdir(), "project203-private-images-");
  const fixture = await mkdtemp(prefix);
  try {
    const imageRoot = path.join(fixture, "private-assets/site");
    await Promise.all(["home", "board", "shared"].map(folder => mkdir(path.join(imageRoot, folder), { recursive: true })));
    const source = await readFile(new URL("../lib/private-assets.ts", import.meta.url), "utf8");
    const config = new URL("../lib/site-images-config.ts", import.meta.url).href;
    // Execute the actual server file in a child whose cwd contains only fake
    // assets. Compile types and resolve its static imports; retain the logic.
    // The server-only marker is enforced by Next.js, rather than plain Node.
    const compiled = ts.transpileModule(source.replace(/^import "server-only";\r?$/m, "")
      .replace('from "./site-images-config"', `from ${JSON.stringify(config)}`), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText;
    const modulePath = path.join(fixture, "private-assets-under-test.mjs");
    await writeFile(modulePath, compiled);
    const check = async statements => {
      const code = `import assert from "node:assert/strict"; import {hasSiteImage,readSiteImage} from ${JSON.stringify(pathToFileURL(modulePath).href)};\n${statements}`;
      await execute(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", code], {
        cwd: fixture, timeout: 15000, windowsHide: true,
        env: { SystemRoot: process.env.SystemRoot, PATH: process.env.PATH },
      });
    };
    await operation({ fixture, imageRoot, check });
  } finally {
    // Only remove the fresh, explicitly prefixed temporary test directory.
    assert(path.resolve(fixture).startsWith(path.resolve(prefix)));
    await rm(fixture, { recursive: true, force: true });
  }
}

test("private image probes and body reads agree for missing images and forbidden keys", async () => {
  await withImageFixture(async ({ check }) => {
    await check(`for (const key of ["homeHero", "boardBanner", "../.env.local", "home/hero.jpg", "constructor", "__proto__", "%2e%2e", "homeHero%00.jpg"]) {
      assert.equal(await hasSiteImage(key), false);
      assert.equal(await readSiteImage(key), null);
    }`);
  });
});

test("private image probes preserve a valid small JPEG and the exact body bytes", async () => {
  await withImageFixture(async ({ imageRoot, check }) => {
    await writeFile(path.join(imageRoot, "home/hero.jpg"), jpeg);
    await check(`assert.equal(await hasSiteImage("homeHero"), true);
      const image = await readSiteImage("homeHero");
      assert.equal(image.type, "image/jpeg");
      assert.equal(image.bytes.toString("base64"), ${JSON.stringify(jpeg.toString("base64"))});`);
  });
});

test("private image probes reject HTML, SVG and renamed signatures without exposing a body", async () => {
  await withImageFixture(async ({ imageRoot, check }) => {
    for (const content of [Buffer.alloc(0), Buffer.from("<html>fixture</html>"), Buffer.from("<svg/>"), Buffer.from("GIF89a"), Buffer.from([137,80,78,71,13,10,26,10])]) {
      await writeFile(path.join(imageRoot, "home/hero.jpg"), content);
      await check('assert.equal(await hasSiteImage("homeHero"), false); assert.equal(await readSiteImage("homeHero"), null);');
    }
  });
});

test("private image probes and reads reject a file above the existing 8 MiB limit", async () => {
  await withImageFixture(async ({ imageRoot, check }) => {
    const file = await open(path.join(imageRoot, "home/hero.jpg"), "w");
    try { await file.write(jpeg); await file.truncate(8 * 1024 * 1024 + 1); }
    finally { await file.close(); }
    await check('assert.equal(await hasSiteImage("homeHero"), false); assert.equal(await readSiteImage("homeHero"), null);');
  });
});

test("private image realpath checks reject an allowed filename symlinked outside the image root", async t => {
  await withImageFixture(async ({ fixture, imageRoot, check }) => {
    const outside = path.join(fixture, "outside");
    await mkdir(outside);
    await writeFile(path.join(outside, "banner.jpg"), jpeg);
    await rmdir(path.join(imageRoot, "board"));
    try { await symlink(outside, path.join(imageRoot, "board"), process.platform === "win32" ? "junction" : "dir"); }
    catch (error) {
      if (["EPERM", "EACCES", "ENOSYS"].includes(error.code)) { t.skip("Test OS cannot create a fixture symlink/junction"); return; }
      throw error;
    }
    await check('assert.equal(await hasSiteImage("boardBanner"), false); assert.equal(await readSiteImage("boardBanner"), null);');
  });
});
