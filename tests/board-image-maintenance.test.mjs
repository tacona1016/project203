import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("image cleanup refuses unconfirmed writes/unknown flags before reading config or contacting Storage", () => {
  const script = fileURLToPath(new URL("../scripts/cleanup-board-images.mjs", import.meta.url));
  for (const args of [["--apply"], ["--unexpected"]]) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8", timeout: 3000,
      env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "invalid-fixture-url", SUPABASE_SECRET_KEY: "fixture-must-not-be-logged" } });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Approved cleanup requires/);
    assert.equal((result.stdout + result.stderr).includes("fixture-must-not-be-logged"), false);
    assert.equal((result.stdout + result.stderr).includes("invalid-fixture-url"), false);
  }
});
