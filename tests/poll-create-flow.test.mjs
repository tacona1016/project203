import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {PollCreateFlow,mapCreatedOptions} from "../lib/poll-images/create-flow.ts";
import {PollRequestError,sendPollImage} from "../lib/poll-images/client.ts";
const image=()=>({clientId:randomUUID(),file:new File(["fixture"],"fake.png",{type:"image/png"}),previewUrl:"blob:fixture"});
const option=(label="same",withImage=false)=>({clientKey:randomUUID(),label,image:withImage?image():null});
const plan=(questions=0,options=[option("A"),option("B")],hidden=false,type="choice")=>({body:{poll_type:type,title:"Test",options:options.map(o=>o.label),is_hidden:hidden},questions:Array.from({length:questions},image),options,hidden});
function fixture(p,overrides={}){
  const calls={create:[],upload:[],state:[],order:[]},saved=[];
  const data={poll:{id:500,slug:"test-created",poll_type:p.body.poll_type,is_hidden:false},options:p.options.map((o,i)=>({id:900+i,poll_id:500,label:o.label.trim(),display_order:i+1}))};
  const services={
    async create(body){calls.create.push(body);data.poll.is_hidden=body.is_hidden;return{slug:data.poll.slug};},
    async detail(){return structuredClone(data);},async list(){return structuredClone(saved);},
    async upload(slug,item){calls.upload.push({id:item.id,option:item.optionId});const row={id:item.id,poll_id:500,option_id:item.optionId,byte_size:100,width:10,height:5,sort_order:saved.length};saved.push(row);return row;},
    async state(slug,action){calls.state.push(action);data.poll.is_hidden=action==="hide";},
    async order(slug,ids){calls.order.push(ids);ids.forEach((id,i)=>saved.find(row=>row.id===id).sort_order=i);},...overrides,
  };
  const progress=[];const flow=new PollCreateFlow(p,value=>progress.push(value),services);return{flow,services,calls,saved,data,progress};
}
test("Image-free creation remains one create and honors visibility",async()=>{
  for(const hidden of [false,true]){const f=fixture(plan(0,undefined,hidden));await f.flow.save();assert(f.flow.progress.completed);assert.equal(f.calls.create.length,1);assert.equal(f.calls.create[0].is_hidden,hidden);assert.equal(f.calls.upload.length,0);}
});
test("One or three question images stay hidden until verified and ordered",async()=>{
  for(const n of [1,3]){const p=plan(n),f=fixture(p);await f.flow.save();assert(f.flow.progress.completed);assert(f.calls.create[0].is_hidden);assert.equal(f.calls.upload.length,n);assert.deepEqual(f.calls.order[0],p.questions.map(i=>i.clientId));assert.deepEqual(f.calls.state,["unhide"]);}
});
test("Four questions and oversized or invalid files are rejected before creation",async()=>{
  const large=plan(1),invalid=plan(1);large.questions[0].file=new File([new Uint8Array(3145729)],"fake.png",{type:"image/png"});invalid.questions[0].file=new File(["html"],"fake.html",{type:"text/html"});
  for(const p of [plan(4),large,invalid]){
    const f=fixture(p);await f.flow.save();assert.equal(f.calls.create.length,0);assert(f.flow.progress.error);assert(!f.flow.progress.completed);
  }
});
test("Duplicate labels, insertion and middle removal bind by unique key and validated display_order",async()=>{
  const removed=option("remove",true),a=option("same",true),b=option("same",true),p=plan(3,[a,removed,b]);
  p.options=p.options.filter(o=>o.clientKey!==removed.clientKey);p.body.options=p.options.map(o=>o.label);
  const f=fixture(p);await f.flow.save();assert(f.flow.progress.completed);assert.equal(f.calls.upload.length,5);
  assert.deepEqual(f.calls.upload.slice(3).map(i=>[i.id,i.option]),[[a.image.clientId,"900"],[b.image.clientId,"901"]]);assert(!f.calls.upload.some(i=>i.id===removed.image.clientId));
  assert.equal(mapCreatedOptions([b,a],{...f.data,options:[...f.data.options].reverse()}).get(b.clientKey),"900");
});
test("Text question photos and intentionally hidden polls never auto-publish",async()=>{
  const f=fixture(plan(3,[],true,"text"));await f.flow.save();assert(f.flow.progress.completed);assert.equal(f.calls.upload.length,3);assert.deepEqual(f.calls.state,["hide"]);assert(f.data.poll.is_hidden);
});
test("Partial upload failure retains successful files and retry never creates again",async()=>{
  const p=plan(3,[option("A",true),option("B")]),f=fixture(p),upload=f.services.upload;let fail=true;
  f.services.upload=async(slug,item)=>{if(item.id===p.questions[1].clientId&&fail){fail=false;throw Error("network");}return upload(slug,item);};
  await f.flow.save();assert(!f.flow.progress.completed);assert.equal(f.saved.length,3);assert(f.data.poll.is_hidden);assert.deepEqual(f.calls.state,[]);
  await f.flow.save();assert(f.flow.progress.completed);assert.equal(f.calls.create.length,1);assert.equal(f.saved.length,4);assert.equal(new Set(f.saved.map(i=>i.id)).size,4);
});
test("Double click while creation is pending has only one create request",async()=>{
  const f=fixture(plan(1)),create=f.services.create;let release;const gate=new Promise(resolve=>release=resolve);
  f.services.create=async body=>{await gate;return create(body);};const first=f.flow.save();await f.flow.save();release();await first;assert.equal(f.calls.create.length,1);assert(f.flow.progress.completed);
});
test("Lost create ACK prevents any automatic or manual retry POST",async()=>{
  const f=fixture(plan(1));f.services.create=async body=>{f.calls.create.push(body);throw Error("ACK lost after commit");};
  await f.flow.save();await f.flow.save();assert.equal(f.calls.create.length,1);assert(f.flow.progress.uncertain);assert(!f.flow.progress.completed);
});
test("Malformed successful creation response is uncertain and cannot invent an undefined slug",async()=>{
  const f=fixture(plan(1));f.services.create=async body=>{f.calls.create.push(body);return {};};await f.flow.save();await f.flow.save();assert(f.flow.progress.uncertain);assert.equal(f.flow.progress.slug,null);assert.equal(f.calls.create.length,1);assert.equal(f.calls.upload.length,0);
});
test("Known validation rejection permits a safe corrected submission",async()=>{
  const f=fixture(plan(0)),create=f.services.create;let fail=true;
  f.services.create=async body=>{if(fail){fail=false;throw new PollRequestError("invalid",400);}return create(body);};await f.flow.save();assert(!f.flow.progress.uncertain);await f.flow.save();assert(f.flow.progress.completed);
});
test("Mapping mismatch and later ID changes fail closed with no wrong image assignment",async()=>{
  for(const change of [d=>d.options.pop(),d=>d.options[0].display_order=2,d=>d.options[0].poll_id=999]){
    const f=fixture(plan(1));change(f.data);await f.flow.save();assert.equal(f.calls.upload.length,0);assert.equal(f.calls.create.length,1);assert(f.data.poll.is_hidden);assert(f.flow.progress.error);
  }
  const f=fixture(plan(1)),upload=f.services.upload;f.services.upload=async()=>{throw Error("pending");};await f.flow.save();f.services.upload=upload;f.data.options[0].id=777;await f.flow.save();assert.equal(f.calls.upload.length,0);assert.equal(f.calls.create.length,1);
});
test("Lost publish ACK is reconciled; failed publish retries state without uploading twice",async()=>{
  for(const committed of [true,false]){const f=fixture(plan(1)),state=f.services.state;let fail=true;
    f.services.state=async(slug,action)=>{if(fail){fail=false;if(committed)await state(slug,action);throw Error("state failure");}return state(slug,action);};
    await f.flow.save();assert.equal(f.flow.progress.completed,committed);if(!committed)await f.flow.save();assert(f.flow.progress.completed);assert.equal(f.calls.create.length,1);assert.equal(f.calls.upload.length,1);
  }
});
test("Explicit completion can omit failed photos without deleting any success",async()=>{
  const p=plan(3),f=fixture(p),upload=f.services.upload;f.services.upload=(slug,item)=>item.id===p.questions[1].clientId?Promise.reject(Error("failed")):upload(slug,item);
  await f.flow.save();await f.flow.save(true);assert(f.flow.progress.completed);assert.equal(f.saved.length,2);assert.equal(f.calls.create.length,1);assert.equal(f.calls.upload.length,2);assert(!f.data.poll.is_hidden);
});
test("Missing image schema never exposes the incomplete poll or creates a second",async()=>{
  const f=fixture(plan(1));f.services.list=async()=>{throw Error("configuration unavailable");};await f.flow.save();await f.flow.save();assert(f.data.poll.is_hidden);assert.equal(f.calls.create.length,1);assert.equal(f.calls.upload.length,0);
});
test("Shared image uploader reconciles lost ACK and preserves ID and option headers",async t=>{
  const id=randomUUID(),file=new File(["fixture"],"x.png",{type:"image/png"}),calls=[];
  t.mock.method(globalThis,"fetch",async(url,init)=>{calls.push({url,init});if(init.method==="POST")throw Error("lost");return Response.json({available:true,images:[{id,option_id:"901",byte_size:123}]});});
  const saved=await sendPollImage("test",{id,file,optionId:"901",replacesId:null});assert.equal(saved.id,id);assert.equal(calls.length,2);assert.equal(calls[0].init.headers["Idempotency-Key"],id);assert.equal(calls[0].init.headers["X-Option-Id"],"901");
});

test("Leaving during creation stops further uploads and never publishes incomplete photos",async()=>{
  const f=fixture(plan(1)),create=f.services.create;let release;const gate=new Promise(resolve=>release=resolve);
  f.services.create=async body=>{await gate;return create(body);};const saving=f.flow.save();f.flow.cancel();release();await saving;
  assert.equal(f.calls.create.length,1);assert.equal(f.calls.upload.length,0);assert.deepEqual(f.calls.state,[]);assert(f.data.poll.is_hidden);assert(!f.flow.progress.completed);
});
