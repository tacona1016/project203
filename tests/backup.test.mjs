import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { keyBytes, encryptFile, decryptBuffer, verifyBackup, jsonInput, privateFile, retentionPlan, requireTestTarget, PRODUCTION_REF } from "../scripts/backup/core.mjs";

async function fixture(run){await mkdir('.verification',{recursive:true});const dir=await mkdtemp(path.resolve('.verification/backup-test-'));try{await run(dir);}finally{if(!dir.startsWith(path.resolve('.verification')+path.sep))throw Error('Unsafe cleanup');await rm(dir,{recursive:true,force:true});}}
test("Backup encryption authenticates data, records SHA/bytes, verifies manifests without plaintext files",async()=>fixture(async dir=>{
  const key=randomBytes(32),bytes=Buffer.from("fixture-only database, no real data");
  const item={name:"database.dump.enc",...await encryptFile(Readable.from([bytes]),privateFile(dir,"database.dump.enc"),key)};
  const manifest={version:1,files:[item]};await encryptFile(jsonInput(manifest),privateFile(dir,"manifest.enc"),key);
  assert(!Buffer.from(await readFile(privateFile(dir,item.name))).includes(bytes));
  assert.deepEqual(await decryptBuffer(privateFile(dir,item.name),key),bytes);
  assert.deepEqual((await verifyBackup(dir,key)).files,[item]);
  await assert.rejects(()=>verifyBackup(dir,randomBytes(32)));
  const damaged=await readFile(privateFile(dir,item.name));damaged[25]^=1;await writeFile(privateFile(dir,item.name),damaged);
  await assert.rejects(()=>verifyBackup(dir,key),/checksum_mismatch/);
}));
test("Backup archive paths, key configuration and production restore fail closed",()=>{
  assert.equal(keyBytes("a".repeat(64)).length,32);assert.throws(()=>keyBytes("short"));
  for(const p of ["../outside","/absolute","safe/../../x","x\\y","x:ads"])assert.throws(()=>privateFile("backups",p));
  assert.throws(()=>requireTestTarget({reference:PRODUCTION_REF,url:`https://${PRODUCTION_REF}.supabase.co`,host:`db.${PRODUCTION_REF}.supabase.co`,confirmation:"ISOLATED_TEST_ONLY"}));
  const ref="a".repeat(20);requireTestTarget({reference:ref,url:`https://${ref}.supabase.co`,host:`db.${ref}.supabase.co`,confirmation:"ISOLATED_TEST_ONLY"});
  assert.throws(()=>requireTestTarget({reference:ref,url:`https://${ref}.supabase.co`,host:`db.${ref}.supabase.co.attacker`,confirmation:"ISOLATED_TEST_ONLY"}));
});
test("Retention selects four distinct weekly sets and twelve monthly sets; never removes failed evidence",()=>{
  const records=Array.from({length:60},(_,i)=>({id:String(i),createdAt:new Date(Date.UTC(2026,10,10)-i*7*86400000).toISOString(),status:"complete"}));
  records.unshift({id:"same-week-manual",createdAt:"2026-11-11T00:00:00Z",status:"complete"});
  const p=retentionPlan(records);assert(p.keep.includes("same-week-manual"));assert(p.keep.length<=16);assert(!p.keep.includes("0"));assert(p.keep.some(id=>Number(id)>40));assert(p.expired.length>0);
  assert.deepEqual(retentionPlan([{id:"failure",createdAt:"2026-11-11T00:00:00Z",status:"failed"}]),{keep:[],expired:[]});
});
test("Backup/restore CLI rejects missing setup and unsafe targets without exposing env values",()=>{
  const env={...process.env,BACKUP_SOURCE_KEY:"fixture-secret-never-print",BACKUP_DB_PASSWORD:"fixture-private-never-print"};delete env.PROJECT203_BACKUP_CONFIRMED;
  for(const args of [["check"],["restore-test","not-a-backup","--confirm-test-restore"]]){
    const r=spawnSync(process.execPath,["scripts/project-backup.mjs",...args],{env,encoding:"utf8"});assert.equal(r.status,1);assert(!`${r.stdout}${r.stderr}`.includes("fixture-secret-never-print"));assert(!`${r.stdout}${r.stderr}`.includes("fixture-private-never-print"));
  }
});
