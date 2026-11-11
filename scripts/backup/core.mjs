import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { open, mkdir, stat, readFile, realpath } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Writable, Transform, Readable } from "node:stream";
import path from "node:path";

const MAGIC=Buffer.from("203BKP01");
export const PRODUCTION_REF="xpyyyqqfnlmgxxlenxua";
export function keyBytes(value){if(typeof value!=="string"||!/^[a-f0-9]{64}$/i.test(value))throw Error("encryption_key_configuration");return Buffer.from(value,"hex");}
export function privateFile(root,name){
  if(typeof name!=="string"||!name||/[\\:\u0000-\u001f]/.test(name)||name.split('/').some(s=>!s||s==='.'||s==='..')||path.isAbsolute(name))throw Error("invalid_archive_path");
  const absolute=path.resolve(root,name),base=path.resolve(root)+path.sep;
  if(!absolute.startsWith(base))throw Error("invalid_archive_path");return absolute;
}
export async function sha256(file){const hash=createHash("sha256");for await(const b of createReadStream(file))hash.update(b);return hash.digest("hex");}
export async function encryptFile(input,file,key){
  await mkdir(path.dirname(file),{recursive:true,mode:0o700});
  const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key,iv),header=Buffer.concat([MAGIC,iv]);
  const handle=await open(file,"wx",0o600);await handle.write(header);await handle.close();
  const hash=createHash("sha256");let plainBytes=0;
  const inspect=new Transform({transform(chunk,_,done){plainBytes+=chunk.length;hash.update(chunk);done(null,chunk);}});
  await pipeline(input,inspect,cipher,createWriteStream(file,{flags:"a",mode:0o600}));
  const out=await open(file,"a");await out.write(cipher.getAuthTag());await out.close();
  return{sha256:await sha256(file),plainSha256:hash.digest("hex"),bytes:(await stat(file)).size,plainBytes};
}
export async function decryptStream(file,key){
  const size=(await stat(file)).size;if(size<36)throw Error("invalid_encrypted_file");
  const h=await open(file,"r"),header=Buffer.alloc(20),tag=Buffer.alloc(16);await h.read(header,0,20,0);await h.read(tag,0,16,size-16);await h.close();
  if(!header.subarray(0,8).equals(MAGIC))throw Error("invalid_encrypted_header");
  const decipher=createDecipheriv("aes-256-gcm",key,header.subarray(8));decipher.setAuthTag(tag);
  const input=createReadStream(file,{start:20,end:size-17});input.on("error",e=>decipher.destroy(e));decipher.on("close",()=>input.destroy());input.pipe(decipher);return decipher;
}
export async function decryptBuffer(file,key,maximum=8*1024*1024){let size=0;const buffers=[];for await(const b of await decryptStream(file,key)){size+=b.length;if(size>maximum)throw Error("metadata_too_large");buffers.push(b);}return Buffer.concat(buffers);}
export async function verifyBackup(directory,key){
  const root=(await realpath(directory))+path.sep;
  if(!(await realpath(privateFile(directory,"manifest.enc"))).startsWith(root))throw Error("archive_symlink_escape");
  const manifest=JSON.parse((await decryptBuffer(privateFile(directory,"manifest.enc"),key)).toString("utf8"));
  if(manifest.version!==1||!Array.isArray(manifest.files)||!manifest.files.some(f=>f.name==="database.dump.enc"))throw Error("invalid_manifest");
  for(const f of manifest.files){
    const file=privateFile(directory,f.name);if(!(await realpath(file)).startsWith(root))throw Error("archive_symlink_escape");
    if(await sha256(file)!==f.sha256)throw Error("checksum_mismatch");
    const hash=createHash("sha256");let size=0;
    await pipeline(await decryptStream(file,key),new Writable({write(b,_,done){size+=b.length;hash.update(b);done();}}));
    if(size!==f.plainBytes||hash.digest("hex")!==f.plainSha256)throw Error("plaintext_mismatch");
  }
  return manifest;
}
export function retentionPlan(records){
  const success=records.filter(r=>r.status==="complete"&&/^\d{4}-\d{2}-\d{2}T/.test(r.createdAt)&&Number.isFinite(Date.parse(r.createdAt))).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
  const keep=new Set(),weeks=new Set(),months=new Set();
  for(const r of success){const d=new Date(r.createdAt);d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);const week=d.toISOString().slice(0,10);
    if(!weeks.has(week)&&weeks.size<4){weeks.add(week);keep.add(r.id);}
    const month=r.createdAt.slice(0,7);if(!months.has(month)&&months.size<12){months.add(month);keep.add(r.id);}}
  return{keep:[...keep],expired:success.filter(r=>!keep.has(r.id)).map(r=>r.id)};
}
export function requireTestTarget({reference,url,host,confirmation}){
  if(confirmation!=="ISOLATED_TEST_ONLY"||typeof reference!=="string"||!/^[a-z]{20}$/.test(reference)||reference===PRODUCTION_REF)throw Error("test_restore_confirmation_required");
  if(url!==`https://${reference}.supabase.co`||host!==`db.${reference}.supabase.co`)throw Error("unsafe_test_target");
}
export function jsonInput(value){return Readable.from([Buffer.from(JSON.stringify(value))]);}
export async function readReceipt(dir){return JSON.parse(await readFile(privateFile(dir,"receipt.json"),"utf8"));}
