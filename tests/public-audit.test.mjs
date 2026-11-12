import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectPublicSource } from "../scripts/audit-public-source.mjs";
test("Public audit reports locations without leaking matched secret values and skips synthetic member examples",()=>{
  const fake="sb_secret_"+"A".repeat(32);const found=inspectPublicSource("leak.ts",fake);assert(found.some(f=>f.rule==='credential_pattern'));assert(!JSON.stringify(found).includes(fake));
  assert(inspectPublicSource("backups/data.dump","").some(f=>f.severity==='high'));
  assert.deepEqual(inspectPublicSource("scripts/backup/core.mjs","export const version = 1;"),[]);
  assert(inspectPublicSource("private-assets/site/home/hero.jpg","").some(f=>f.rule==='personal_photo_in_git'));
  assert.deepEqual(inspectPublicSource(".env.example",'BOARD_PARTICIPANT_PASSWORDS={"00000000-0000-4000-8000-000000000001":"example-only"}'),[]);
});
