import assert from "node:assert/strict";
import sharp from "sharp";
import { randomUUID, createHash } from "node:crypto";
export async function runPollImageChecks({ a, b, anonymous, adminPassword, base="http://127.0.0.1:3100" }) {
  const checks=[];
  const control=async body=>(await fetch('http://127.0.0.1:3102/_test',{method:'POST',body:JSON.stringify(body)})).json();
  assert.equal((await a.call('/api/admin/access','POST',{password:adminPassword})).status,200);
  const input={quarter:'2026-q4',title:'Synthetic poll image validation',description:'Test only',poll_type:'choice',results_visibility:'after_close',text_max_length:1000,vote_mode:'multiple',allow_vote_change:true,scheduled:false,is_hidden:false,options:['A','B','C']};
  const created=await a.call('/api/admin/polls','POST',input);assert.equal(created.status,200);const {slug}=await created.json();
  const url=`/api/admin/polls/${slug}/images`,detail=async()=> (await a.call(`/api/admin/polls/${slug}`)).json();
  const original=await detail(),optionIds=original.options.map(o=>o.id);
  const png=await sharp({create:{width:320,height:160,channels:4,background:'#2453df88'}}).png().withMetadata({orientation:6}).toBuffer();
  async function upload(id=randomUUID(),option=null,replaces=null,bytes=png,type='image/png',who=a,origin=base){
    return fetch(base+url,{method:'POST',headers:{Origin:origin,Cookie:[...who.cookies].map(([k,v])=>`${k}=${v}`).join('; '),'Content-Type':type,'Idempotency-Key':id,...(option?{'X-Option-Id':String(option)}:{}),...(replaces?{'X-Replaces-Image-Id':replaces}:{})},body:bytes});
  }
  assert.equal((await anonymous.call(`/api/polls/${slug}/images/${randomUUID()}`)).status,401);
  assert.equal((await upload(randomUUID(),null,null,png,'image/png',b)).status,403);
  assert.equal((await upload(randomUUID(),null,null,png,'image/png',a,'https://outside.invalid')).status,403);
  assert.equal((await upload(randomUUID(),null,null,png,'image/jpeg')).status,415);
  assert.equal((await upload(randomUUID(),null,null,Buffer.alloc(3145729))).status,413);
  assert.equal((await upload(randomUUID(),999999)).status,400);
  checks.push('Member/admin/Same-Origin guards; signature/MIME/3MiB; foreign option rejection');
  const ids=[randomUUID(),randomUUID(),randomUUID()];
  for(const id of ids){const response=await upload(id);assert.equal(response.status,200);const image=await response.json();assert.equal(image.id,id);assert(image.byte_size<=500000);assert(!('storage_path'in image)&&!('sha256'in image)&&!('uploaded_by'in image));}
  assert.equal((await upload()).status,409);assert.equal((await upload(ids[0])).status,200);
  const read=await b.call(`/api/polls/${slug}/images/${ids[0]}`);assert.equal(read.status,200);assert.match(read.headers.get('cache-control'),/private, no-store/);assert.equal(read.headers.get('x-content-type-options'),'nosniff');
  const bytes=Buffer.from(await read.arrayBuffer()),meta=await sharp(bytes).metadata();assert(bytes.length<=500000);assert.equal(meta.format,'webp');assert(meta.hasAlpha&&!meta.exif);assert.equal(meta.width,160);assert.equal(meta.height,320);
  const stats=await control({});const stored=stats.pollImages.find(i=>i.id===ids[0]);assert.equal(stored.sha256,createHash('sha256').update(bytes).digest('hex'));assert.equal(stored.byte_size,bytes.length);
  checks.push('Three question slots; fourth blocked; exact idempotency; private verified WebP/alpha/orientation/hash');
  const optionImage=randomUUID();assert.equal((await upload(optionImage,optionIds[0])).status,200);assert.equal((await upload(randomUUID(),optionIds[0])).status,409);
  const concurrent=await Promise.all([upload(randomUUID(),optionIds[1]),upload(randomUUID(),optionIds[1])]);assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
  checks.push('One image per real option; concurrent HTTP requests; question/option independence (synthetic DB)');
  const reordered=[...ids].reverse();const reorderedResponse=await a.call(url,'PATCH',{ids:reordered});assert.equal(reorderedResponse.status,200);assert.deepEqual((await reorderedResponse.json()).images.filter(i=>i.option_id===null).map(i=>i.id),reordered);
  const replacement=randomUUID();await control({pollImageFailures:{upload:1}});assert.equal((await upload(replacement,null,ids[0])).status,503);assert.equal((await b.call(`/api/polls/${slug}/images/${ids[0]}`)).status,200);
  await control({agePollImages:true});assert.equal((await upload(replacement,null,ids[0])).status,200);assert.equal((await b.call(`/api/polls/${slug}/images/${ids[0]}`)).status,404);assert.equal((await upload(replacement,null,ids[0])).status,200);
  checks.push('Atomic ordering and replacement; failed upload keeps old ready image; expired-lease retry and lost ACK idempotency');
  await control({pollImageFailures:{lostFinish:1}});const ack=randomUUID();assert.equal((await upload(ack,optionIds[2])).status,200);
  const lost=randomUUID();await control({pollImageFailures:{lostUpload:1}});assert.equal((await upload(lost,optionIds[2],ack)).status,503);assert.equal((await b.call(`/api/polls/${slug}/images/${ack}`)).status,200);
  await control({agePollImages:true});assert.equal((await upload(lost,optionIds[2],ack)).status,200);assert.equal((await upload(lost,optionIds[2],ack)).status,200);
  await control({pollImageFailures:{corrupt:1}});assert.equal((await b.call(`/api/polls/${slug}/images/${lost}`)).status,503);
  const remove=`${url}/${optionImage}`;await control({pollImageFailures:{remove:1}});assert.equal((await a.call(remove,'DELETE')).status,503);assert.equal((await b.call(`/api/polls/${slug}/images/${optionImage}`)).status,404);await control({agePollImages:true});assert.equal((await a.call(`${url}/cleanup`,'POST')).status,200);
  checks.push('Lost finalize ACK reconciled; corrupted Storage rejected; failed deletion tracked/hidden and bounded cleanup retries');
  const before=await control({});
  const vote=await b.call(`/api/polls/${slug}/votes`,'POST',{optionIds:[optionIds[0],optionIds[1]]});assert.equal(vote.status,200);
  const voted=await control({});const member=await (await b.call(`/api/polls/${slug}`)).json();assert.equal(member.results,null);assert.equal(member.responses,null);assert(member.attachments.images.length>0);
  const change=randomUUID();assert.equal((await upload(change,optionIds[2],lost)).status,200);
  const after=await control({});assert.deepEqual(after.votes,voted.votes);assert.deepEqual(after.choiceSelections,voted.choiceSelections);assert.deepEqual(after.options,voted.options);assert.equal((await detail()).poll.id,original.poll.id);
  assert.equal(before.options.length,after.options.length);
  assert.equal((await a.call(`/api/admin/polls/${slug}`,'PATCH',{...input,options:['changed','B','C']})).status,409);
  checks.push('Existing ballot/option IDs and counts unchanged by images after votes; private results remain null; option edits protected');
  await a.call(`/api/admin/polls/${slug}/state`,'POST',{action:'hide'});assert.equal((await b.call(`/api/polls/${slug}/images/${change}`)).status,404);assert.equal((await a.call(`/api/polls/${slug}/images/${change}`)).status,200);
  await a.call(`/api/admin/polls/${slug}/state`,'POST',{action:'unhide'});
  await control({pollImagesMissing:true});const fallback=await (await b.call(`/api/polls/${slug}`)).json();assert.equal(fallback.attachments.available,false);assert.equal(fallback.poll.id,original.poll.id);await control({pollImagesMissing:false,pollImageFailures:{query:1}});const outage=await (await b.call(`/api/polls/${slug}`)).json();assert(outage.attachments.error);assert.equal(outage.results,null);
  checks.push('Hidden poll image denied; admin allowed; missing schema safe fallback; DB outage distinguished from empty attachments');
  const textCreated=await a.call('/api/admin/polls','POST',{...input,title:'Synthetic text image',poll_type:'text',vote_mode:'single',options:[]});assert.equal(textCreated.status,200);const textSlug=(await textCreated.json()).slug;
  const textImage=randomUUID();const textUpload=await fetch(`${base}/api/admin/polls/${textSlug}/images`,{method:'POST',headers:{Origin:base,Cookie:[...a.cookies].map(([k,v])=>`${k}=${v}`).join('; '),'Content-Type':'image/png','Idempotency-Key':textImage},body:png});assert.equal(textUpload.status,200);
  checks.push('Text polls accept question images without choice options');
  return {checks,slug,optionIds};
}
