// Explicit maintenance tool. Default is read-only; never run --apply without
// target review/approval. No IDs, file paths, keys, or content are printed.
import { createClient } from "@supabase/supabase-js";
import nextEnv from "@next/env";
import { randomUUID } from "node:crypto";
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
if ([...args].some(arg => !["--apply", "--confirm-board-image-cleanup"].includes(arg)) || apply && !args.has("--confirm-board-image-cleanup")) {
  console.error("Use no flags for read-only counts. Approved cleanup requires --apply --confirm-board-image-cleanup.");
  process.exit(1);
}
nextEnv.loadEnvConfig(process.cwd());
const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.SUPABASE_SECRET_KEY;
if(!url||!key){console.error("Server Supabase configuration is missing.");process.exit(1);}
let client;
try { client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(10_000)})}}); }
catch { console.error("Server Supabase configuration is invalid."); process.exit(1); }
async function run(){
  const result=await client.rpc('board_image_cleanup_candidates',{}).retry(false);
  if(result.error||!Array.isArray(result.data))throw Error('Unavailable');
  let removed=0,failed=0;
  if(apply)for(const id of result.data){
    const token=randomUUID();const claim=await client.rpc('claim_board_image_cleanup',{p_id:id,p_token:token}).retry(false);
    if(claim.error){failed++;continue;}if(!claim.data)continue;
    const row=claim.data;
    if(row.id!==id||row.storage_path!==`posts/${row.post_id}/${id}.webp`){failed++;continue;}
    const deleted=await client.storage.from('board-attachments').remove([row.storage_path]);
    if(deleted.error){failed++;continue;}
    const purge=await client.rpc('purge_board_image',{p_id:id,p_token:token}).retry(false);
    if(purge.error||!purge.data?.deleted)failed++;else removed++;
  }
  console.log(JSON.stringify({dryRun:!apply,candidates:result.data.length,removed,failed}));
  if(failed)process.exitCode=1;
}
run().catch(()=>{console.error("Image maintenance could not complete. Verify the approved target and new RPC setup; no secret details are logged.");process.exitCode=1;});
