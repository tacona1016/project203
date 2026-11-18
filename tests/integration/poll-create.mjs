import assert from "node:assert/strict";
import sharp from "sharp";
import {randomUUID} from "node:crypto";
import {PollCreateFlow} from "../../lib/poll-images/create-flow.ts";
export async function runPollCreateChecks({a,base="http://127.0.0.1:3100",adminPassword}){
  assert.equal((await a.call("/api/admin/access","POST",{password:adminPassword})).status,200);
  const original=globalThis.fetch,calls=[];let dropCreate=false,wrongMapping=false;
  const control=async body=>(await original("http://127.0.0.1:3102/_test",{method:"POST",body:JSON.stringify(body)})).json();
  const png=await sharp({create:{width:200,height:100,channels:4,background:"#2453df88"}}).png().toBuffer();
  const image=()=>({clientId:randomUUID(),previewUrl:"blob:fixture",file:new File([png],"test.png",{type:"image/png"})});
  const plan=(questions=0,images=0,hidden=false,text=false)=>({body:{quarter:"2026-q4",title:"Create HTTP "+randomUUID(),description:"Synthetic only",options:text?[]:["same","same","C"],poll_type:text?"text":"choice",vote_mode:images>1?"multiple":"single",allow_vote_change:true,results_visibility:"after_close",text_max_length:1000,scheduled:false,start:"",end:"",is_hidden:hidden},questions:Array.from({length:questions},image),options:text?[]:["same","same","C"].map((label,index)=>({clientKey:randomUUID(),label,image:index<images?image():null})),hidden});
  globalThis.fetch=async(input,init={})=>{
    if(typeof input!=="string"||!input.startsWith("/"))return original(input,init);
    const method=init.method??"GET",url=new URL(input,base),headers=new Headers(init.headers);headers.set("Origin",base);headers.set("Cookie",[...a.cookies].map(([k,v])=>`${k}=${v}`).join("; "));
    calls.push({path:url.pathname,method});
    if(method==="POST"&&url.pathname.endsWith("/images")){const current=await control({});const slug=url.pathname.split("/")[4];assert(current.polls.find(p=>p.slug===slug).is_hidden,"Every upload must occur while hidden");}
    const response=await original(url,{...init,headers});
    if(method==="POST"&&url.pathname==="/api/admin/polls"&&response.ok&&dropCreate){dropCreate=false;throw Error("create ACK deliberately lost");}
    if(method==="GET"&&/^\/api\/admin\/polls\/[^/]+$/.test(url.pathname)&&response.ok&&wrongMapping){const value=await response.json();value.options.pop();return Response.json(value);}
    return response;
  };
  const checks=[];
  try{
    const before=await control({});
    for(const [q,opts,hidden,text]of [[0,0,false,false],[1,0,false,false],[3,2,false,false],[3,0,true,true]]){
      const p=plan(q,opts,hidden,text),flow=new PollCreateFlow(p,()=>{});await flow.save();assert(flow.progress.completed,flow.progress.error);
      const state=await control({}),poll=state.polls.find(item=>item.slug===flow.progress.slug);assert.equal(poll.is_hidden,hidden);
      const rows=state.pollImages.filter(item=>String(item.poll_id)===String(poll.id)&&item.state==="ready");assert.equal(rows.length,q+opts);assert(rows.every(item=>item.byte_size<=500000));
      const savedOptions=state.options.filter(item=>item.poll_id===poll.id).sort((a,b)=>a.display_order-b.display_order);
      p.options.forEach((option,index)=>{if(option.image)assert.equal(String(rows.find(row=>row.id===option.image.clientId).option_id),String(savedOptions[index].id));});
    }
    checks.push("Existing APIs create no-image, one/three question, mixed duplicate-label option images and hidden text polls; exact real IDs; <=500000 bytes");
    const p=plan(3,2),flow=new PollCreateFlow(p,()=>{});await control({pollImageFailures:{upload:1}});const start=calls.length;await flow.save();assert(!flow.progress.completed);const failed=flow.progress.uploads.filter(item=>!item.ready);assert.equal(failed.length,1);
    const state=await control({});assert(state.polls.find(p=>p.slug===flow.progress.slug).is_hidden);const beforeRetry=calls.filter(c=>c.method==="POST"&&c.path.endsWith("/images")).length;
    await control({agePollImages:true});await flow.save();assert(flow.progress.completed,flow.progress.error);assert.equal(calls.slice(start).filter(c=>c.method==="POST"&&c.path==="/api/admin/polls").length,1);assert.equal(calls.filter(c=>c.method==="POST"&&c.path.endsWith("/images")).length-beforeRetry,1);
    checks.push("Partial Storage failure keeps poll hidden and all successful images; retry sends only failed image and never creates another poll");
    const uncertain=new PollCreateFlow(plan(1),()=>{});const prev=(await control({})).polls.length;dropCreate=true;await uncertain.save();await uncertain.save();assert(uncertain.progress.uncertain);const afterLost=await control({});assert.equal(afterLost.polls.length,prev+1);assert(afterLost.polls.at(-1).is_hidden);
    checks.push("Committed create with lost HTTP ACK stays hidden; repeated save never sends a second create");
    const bad=new PollCreateFlow(plan(1,1),()=>{});wrongMapping=true;const beforeBad=calls.filter(c=>c.method==="POST"&&c.path.endsWith("/images")).length;await bad.save();wrongMapping=false;assert(bad.progress.error);assert.equal(calls.filter(c=>c.method==="POST"&&c.path.endsWith("/images")).length,beforeBad);
    checks.push("Unexpected saved option count fails closed before image assignment");
    const after=await control({});assert.deepEqual(before.votes,after.votes);assert.deepEqual(before.choiceSelections,after.choiceSelections);assert.deepEqual(before.comments,after.comments);
    checks.push("Existing votes, canonical choice selections and comments remain byte-for-byte identical in protocol fixture");
    return checks;
  }finally{globalThis.fetch=original;}
}
