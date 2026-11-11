// No schedule, credentials, destination creation or production restore is implicit.
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, unlink, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { keyBytes, encryptFile, decryptStream, decryptBuffer, verifyBackup, jsonInput, privateFile, sha256, requireTestTarget, retentionPlan } from "./backup/core.mjs";

const command=process.argv[2]??"help",args=process.argv.slice(3);
let stage="preflight";
const requireValue=name=>{const v=process.env[name];if(!v)throw Error(`missing_configuration:${name}`);return v;};
const pgEnvironment=target=>({ ...process.env, PGHOST:requireValue(`${target}_DB_HOST`), PGPORT:process.env[`${target}_DB_PORT`]??"5432",
  PGUSER:requireValue(`${target}_DB_USER`), PGPASSWORD:requireValue(`${target}_DB_PASSWORD`), PGDATABASE:process.env[`${target}_DB_NAME`]??"postgres", PGSSLMODE:"require",
  PGOPTIONS:target==="BACKUP"?"-c default_transaction_read_only=on -c statement_timeout=1800000":"-c statement_timeout=1800000" });
function processCommand(program,values,env=process.env,toc){
  let executable=program,argv=values;
  if(process.env.PROJECT203_PG_CONTAINER&&["psql","pg_dump","pg_restore"].includes(program)){
    if(process.env.PROJECT203_PG_CONTAINER!=="postgres:17")throw Error("unsupported_pg_container");
    executable="docker";argv=["run","--rm","-i",...["PGHOST","PGPORT","PGUSER","PGPASSWORD","PGDATABASE","PGSSLMODE","PGOPTIONS"].flatMap(k=>["-e",k]),
      ...(toc?["--mount",`type=bind,source=${toc},target=/restore.toc,readonly`]:[]),"postgres:17",program,...values];
  }
  const child=spawn(executable,argv,{env,windowsHide:true,stdio:["pipe","pipe","pipe"]});
  child.stderr.resume(); // Upstream errors can contain hostnames/connection strings; never print.
  const done=new Promise((resolve,reject)=>{child.once("error",()=>{child.stdout.destroy(Error("tool_unavailable"));reject(Error("tool_unavailable"));});child.once("close",code=>code===0?resolve():reject(Error("external_command_failed")));});done.catch(()=>{});
  return{child,done};
}
async function collect(program,values,env,input,toc){
  const p=processCommand(program,values,env,toc),chunks=[];let length=0;
  p.child.stdin.on("error",()=>{});
  if(input?.pipe)input.pipe(p.child.stdin);else p.child.stdin.end(input??"");
  for await(const b of p.child.stdout){length+=b.length;if(length>32*1024*1024){p.child.kill();throw Error("metadata_limit");}chunks.push(b);}
  await p.done;return Buffer.concat(chunks).toString("utf8").trim();
}
const sqlArgs=["-X","--no-password","--quiet","--tuples-only","--no-align","--set","ON_ERROR_STOP=1"];
const inventorySQL=`select jsonb_build_object(
 'tables',(select coalesce(jsonb_object_agg(tablename,jsonb_build_object('rows',((xpath('//c/text()',query_to_xml(format('select count(*) as c from public.%I',tablename),true,true,'')))[1]::text)::bigint,'rls',rowsecurity,
 'anon',has_table_privilege('anon',format('public.%I',tablename),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
 'authenticated',has_table_privilege('authenticated',format('public.%I',tablename),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
 'anonColumns',has_any_column_privilege('anon',format('public.%I',tablename),'SELECT,INSERT,UPDATE,REFERENCES'),
 'authenticatedColumns',has_any_column_privilege('authenticated',format('public.%I',tablename),'SELECT,INSERT,UPDATE,REFERENCES'))),'{}'::jsonb) from pg_tables where schemaname='public'),
 'functions',(select coalesce(jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'anon',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE')) order by p.oid::regprocedure::text),'[]'::jsonb) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and not exists(select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')),
 'sequences',(select coalesce(jsonb_agg(jsonb_build_object('name',sequencename,'anon',has_sequence_privilege('anon',format('public.%I',sequencename),'USAGE,SELECT,UPDATE'),'authenticated',has_sequence_privilege('authenticated',format('public.%I',sequencename),'USAGE,SELECT,UPDATE')) order by sequencename),'[]'::jsonb) from pg_sequences where schemaname='public'),
 'buckets',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types)),'[]'::jsonb) from storage.buckets),
 'objects',(select coalesce(jsonb_agg(jsonb_build_object('bucket',bucket_id,'name',name,'metadata',metadata,'updatedAt',updated_at) order by bucket_id,name),'[]'::jsonb) from storage.objects),
 'readyImages',(select coalesce(jsonb_agg(jsonb_build_object('path',storage_path,'sha256',sha256,'bytes',byte_size)),'[]'::jsonb) from public.board_post_images where state='ready')
);`;
async function snapshot(env){
  const p=processCommand("psql",sqlArgs,env);let text="";
  const ready=new Promise((resolve,reject)=>{p.child.stdout.on("data",b=>{text+=b.toString();if(text.includes("SNAPSHOT_READY")){const id=text.split(/\r?\n/).find(x=>/^[0-9a-f]{8}-[0-9a-f]{8}-\d+$/i.test(x.trim()))?.trim();if(id)resolve(id);else reject(Error("snapshot_invalid"));}});p.child.once("error",()=>reject(Error("snapshot_unavailable")));p.child.once("close",()=>reject(Error("snapshot_unavailable")));});
  p.child.stdin.on("error",()=>{});p.child.stdin.write("begin isolation level repeatable read read only;\nselect pg_export_snapshot();\n\\echo SNAPSHOT_READY\n");
  const timer=setTimeout(()=>p.child.kill(),30000);
  try {const id=await ready;clearTimeout(timer);return{id,close:async()=>{p.child.stdin.end("rollback;\n");await p.done;}};}catch(e){clearTimeout(timer);p.child.kill();throw e;}
}
function sourceConfig(){
  if(process.env.PROJECT203_BACKUP_CONFIRMED!=="READ_ONLY_SOURCE")throw Error("source_confirmation_required");
  const ref=requireValue("BACKUP_SOURCE_REF"),url=requireValue("BACKUP_SOURCE_URL"),key=requireValue("BACKUP_SOURCE_KEY");
  if(!/^[a-z]{20}$/.test(ref)||url!==`https://${ref}.supabase.co`)throw Error("source_configuration_invalid");
  const env=pgEnvironment("BACKUP");if(env.PGHOST!==`db.${ref}.supabase.co`)throw Error("source_db_mismatch");
  return{ref,url,key,env,encryption:keyBytes(requireValue("BACKUP_ENCRYPTION_KEY"))};
}
async function privateDestination(){
  if(process.env.BACKUP_DESTINATION_CONFIRMED!=="PRIVATE_APPROVED")throw Error("destination_approval_required");
  const bucket=requireValue("BACKUP_S3_BUCKET"),prefix=requireValue("BACKUP_S3_PREFIX");
  if(!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)||!/^project203-backups\/[a-z0-9-]+$/.test(prefix))throw Error("unsafe_destination");
  const block=JSON.parse(await collect("aws",["s3api","get-public-access-block","--bucket",bucket]));
  const policy=JSON.parse(await collect("aws",["s3api","get-bucket-policy-status","--bucket",bucket]));
  if(!Object.values(block.PublicAccessBlockConfiguration??{}).every(v=>v===true)||Object.keys(block.PublicAccessBlockConfiguration??{}).length!==4||policy.PolicyStatus?.IsPublic!==false)throw Error("destination_not_private");
  return{bucket,prefix};
}
async function createBackup(upload){
  const c=sourceConfig();const destination=upload?await privateDestination():null;
  const id=new Date().toISOString().replaceAll(":","-")+"-"+randomUUID().slice(0,8),directory=path.resolve("backups",id);
  await mkdir(directory,{recursive:false,mode:0o700});let hold;
  try{
    stage="snapshot";hold=await snapshot(c.env);
    const inventory=JSON.parse(await collect("psql",sqlArgs,c.env,`begin isolation level repeatable read read only;set transaction snapshot '${hold.id}';${inventorySQL}rollback;`));
    if(inventory.buckets.some(b=>b.public))throw Error("public_storage_requires_separate_review");
    if(inventory.readyImages.some(i=>!inventory.objects.some(o=>o.bucket==="board-attachments"&&o.name===i.path)))throw Error("ready_image_missing_storage");
    const files=[];stage="database_dump";
    const dump=processCommand("pg_dump",["--no-password","--format=custom","--no-owner","--schema=public",`--snapshot=${hold.id}`],c.env);dump.child.stdin.end();
    const encoded=await encryptFile(dump.child.stdout,privateFile(directory,"database.dump.enc"),c.encryption);await dump.done;files.push({name:"database.dump.enc",...encoded});
    stage="storage_download";
    for(const object of inventory.objects){
      const objectPath=[object.bucket,...object.name.split('/')].map(encodeURIComponent).join('/');
      const r=await fetch(`${c.url}/storage/v1/object/authenticated/${objectPath}`,{headers:{apikey:c.key,Authorization:`Bearer ${c.key}`},signal:AbortSignal.timeout(60000)});
      if(!r.ok||!r.body)throw Error("storage_download_failed");
      const etag=object.metadata?.eTag??object.metadata?.etag;if(etag&&r.headers.get("etag")&&String(etag).replaceAll('"','')!==r.headers.get("etag").replaceAll('"',''))throw Error("storage_changed_during_backup");
      const name=`storage/${createHash('sha256').update(object.bucket+'\0'+object.name).digest('hex')}.enc`;
      const saved=await encryptFile(Readable.fromWeb(r.body),privateFile(directory,name),c.encryption);
      if(object.metadata?.size!=null&&Number(object.metadata.size)!==saved.plainBytes)throw Error("storage_size_changed");
      const ready=inventory.readyImages.find(i=>object.bucket==="board-attachments"&&i.path===object.name);
      if(ready&&(ready.sha256!==saved.plainSha256||Number(ready.bytes)!==saved.plainBytes))throw Error("image_hash_mismatch");
      files.push({name,...saved,object:{bucket:object.bucket,path:object.name,contentType:object.metadata?.mimetype??"application/octet-stream"}});
    }
    stage="manifest";
    const gitCommit=process.env.GITHUB_SHA??process.env.BACKUP_GIT_SHA??await collect("git",["rev-parse","HEAD"]);
    if(!/^[a-f0-9]{40}$/i.test(gitCommit))throw Error("git_commit_unavailable");
    const manifest={version:1,id,createdAt:new Date().toISOString(),gitCommit,sourceRef:c.ref,inventory,files};
    await encryptFile(jsonInput(manifest),privateFile(directory,"manifest.enc"),c.encryption);
    stage="verification";await verifyBackup(directory,c.encryption);
    const receipt={id,createdAt:manifest.createdAt,gitCommit:manifest.gitCommit,status:"complete",tables:Object.fromEntries(Object.entries(inventory.tables).map(([k,v])=>[k,v.rows])),storageObjects:inventory.objects.length,manifestSha256:await sha256(privateFile(directory,"manifest.enc"))};
    await writeFile(privateFile(directory,"receipt.json"),JSON.stringify(receipt,null,2),{mode:0o600});
    if(destination){stage="private_upload";
      for(const name of [...files.map(f=>f.name),"manifest.enc","receipt.json"]){const file=privateFile(directory,name),hash=await sha256(file);await collect("aws",["s3api","put-object","--bucket",destination.bucket,"--key",`${destination.prefix}/${id}/${name}`,"--body",file,"--metadata",`sha256=${hash}`,"--checksum-algorithm","SHA256"]);const remote=JSON.parse(await collect("aws",["s3api","head-object","--bucket",destination.bucket,"--key",`${destination.prefix}/${id}/${name}`,"--checksum-mode","ENABLED"]));if(remote.Metadata?.sha256!==hash||remote.ChecksumSHA256!==Buffer.from(hash,"hex").toString("base64")||Number(remote.ContentLength)!==(await stat(file)).size)throw Error("destination_verification_failed");}
    }
    return{status:"complete",encrypted:true,uploaded:!!destination,storageObjects:inventory.objects.length,tables:Object.keys(inventory.tables).length,restoreTested:false};
  } catch {
    // Partial/encrypted files are retained for diagnosis, never reported as a
    // successful off-site backup. Nothing is automatically deleted.
    await writeFile(privateFile(directory,"receipt.json"),JSON.stringify({id,createdAt:new Date().toISOString(),status:"failed",stage,restoreTested:false}),{mode:0o600}).catch(()=>{});
    throw Error("backup_incomplete");
  } finally {if(hold)await hold.close();}
}
async function restoreTest(directory){
  requireTestTarget({reference:process.env.RESTORE_TEST_REF,url:process.env.RESTORE_TEST_URL,host:process.env.RESTORE_TEST_DB_HOST,confirmation:process.env.RESTORE_TEST_CONFIRM});
  if(!args.includes("--confirm-test-restore"))throw Error("test_restore_flag_required");
  const key=keyBytes(requireValue("BACKUP_ENCRYPTION_KEY")),env=pgEnvironment("RESTORE_TEST"),manifest=await verifyBackup(directory,key);
  if(manifest.sourceRef===process.env.RESTORE_TEST_REF)throw Error("restore_source_equals_target");
  const count=await collect("psql",sqlArgs,env,"select count(*) from pg_tables where schemaname='public';");if(count!=="0")throw Error("test_database_must_be_empty");
  if(await collect("psql",sqlArgs,env,"select count(*) from storage.objects;")!=="0")throw Error("test_storage_must_be_empty");
  const url=requireValue("RESTORE_TEST_URL"),apiKey=requireValue("RESTORE_TEST_KEY");
  for(const bucket of manifest.inventory.buckets){const r=await fetch(`${url}/storage/v1/bucket/${encodeURIComponent(bucket.id)}`,{headers:{apikey:apiKey,Authorization:`Bearer ${apiKey}`}});if(!r.ok||(await r.json()).public!==false)throw Error("prepare_private_test_bucket_first");}
  stage="test_restore";
  const toc=(await collect("pg_restore",["--list"],env,await decryptStream(privateFile(directory,"database.dump.enc"),key))).split('\n').filter(line=>!/^\d+;.*\bSCHEMA - public\b/.test(line)).join('\n');
  const tocPath=privateFile(directory,`restore-${randomUUID()}.toc`);await writeFile(tocPath,toc,{mode:0o600});
  try {const listPath=process.env.PROJECT203_PG_CONTAINER?"/restore.toc":tocPath;const target=processCommand("pg_restore",["--no-password","--no-owner","--exit-on-error","--single-transaction","--dbname",env.PGDATABASE,"--use-list",listPath],env,tocPath);
    await pipeline(await decryptStream(privateFile(directory,"database.dump.enc"),key),target.child.stdin);await target.done;
  }finally{await unlink(tocPath);}
  const restored=JSON.parse(await collect("psql",sqlArgs,env,inventorySQL));
  if(JSON.stringify(restored.tables)!==JSON.stringify(manifest.inventory.tables)||JSON.stringify(restored.functions)!==JSON.stringify(manifest.inventory.functions)||JSON.stringify(restored.sequences)!==JSON.stringify(manifest.inventory.sequences))throw Error("restored_counts_or_permissions_mismatch");
  // Writes below are restricted to the explicitly confirmed, distinct TEST project.
  for(const f of manifest.files.filter(f=>f.object)){const b=await decryptBuffer(privateFile(directory,f.name),key,64*1024*1024);const objectPath=[f.object.bucket,...f.object.path.split('/')].map(encodeURIComponent).join('/');const r=await fetch(`${url}/storage/v1/object/${objectPath}`,{method:"POST",headers:{apikey:apiKey,Authorization:`Bearer ${apiKey}`,"Content-Type":f.object.contentType,"x-upsert":"false"},body:b});if(!r.ok)throw Error("test_storage_restore_failed");const check=await fetch(`${url}/storage/v1/object/authenticated/${objectPath}`,{headers:{apikey:apiKey,Authorization:`Bearer ${apiKey}`}});if(!check.ok||createHash('sha256').update(Buffer.from(await check.arrayBuffer())).digest('hex')!==f.plainSha256)throw Error("test_storage_hash_mismatch");}
  const verified=JSON.parse(await collect("psql",sqlArgs,env,inventorySQL));if(verified.objects.length!==manifest.inventory.objects.length)throw Error("test_storage_count_mismatch");
  return{status:"test_restore_complete",tables:Object.keys(restored.tables).length,storageObjects:verified.objects.length};
}
try{
  if(command==="help")console.log("project-backup: check | create [--upload] | verify <backup-dir> | restore-test <backup-dir> --confirm-test-restore | retention <private-receipts.json>");
  else if(command==="check"){sourceConfig();await collect("pg_dump",["--version"],pgEnvironment("BACKUP"));console.log(JSON.stringify({status:"configured",scheduleActive:false,destinationChecked:false}));}
  else if(command==="create"){if(args.some(a=>a!=="--upload"))throw Error("unknown_flag");await mkdir("backups",{recursive:true,mode:0o700});console.log(JSON.stringify(await createBackup(args.includes("--upload"))));}
  else if(command==="verify"){await verifyBackup(path.resolve(args[0]??""),keyBytes(requireValue("BACKUP_ENCRYPTION_KEY")));console.log(JSON.stringify({status:"encrypted_backup_verified",restoreTested:false}));}
  else if(command==="restore-test")console.log(JSON.stringify(await restoreTest(path.resolve(args[0]??""))));
  else if(command==="retention"){const plan=retentionPlan(JSON.parse(await readFile(args[0],"utf8")));console.log(JSON.stringify({retained:plan.keep.length,expired:plan.expired.length,deleted:0,approvalRequiredForPruning:true}));}
  else throw Error("unknown_command");
}catch(error){const code=/^(?:missing_configuration:[A-Z_]+|[a-z_]+)$/.test(error?.message??"")?error.message:"internal_failure";console.error(JSON.stringify({status:"failed",stage,code,credentialsPrinted:false,productionRestoreAllowed:false}));process.exitCode=1;}
