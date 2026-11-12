import assert from "node:assert/strict";

export async function runProjectAdminChecks({ manager, member, anonymous, id }) {
  const control=async body=>(await fetch("http://127.0.0.1:3103/_test",{method:"POST",body:JSON.stringify(body??{})})).json();
  const save=body=>manager.call("/api/admin/project","POST",body);
  const html=async()=>(await manager.call("/")).text();
  const status={phase:"合成 phase for fixture",goal:"Synthetic discussion",nextAction:"Synthetic next action",updatedAt:"2026-11-11",relatedLinks:[{label:"notice",href:"/board/90"}]};
  assert.equal((await anonymous.call("/api/admin/project")).status,401);
  assert.equal((await member.call("/api/admin/project")).status,403);
  assert.equal((await member.call("/api/admin/project","POST",{kind:"status",action:"save",version:0,data:status})).status,403);
  assert.equal((await manager.call("/api/admin/project","POST",{},"https://outside.invalid")).status,403);
  assert.equal((await (await manager.call("/api/admin/project")).json()).configured,false);
  await control({projectMode:"database",projectReset:true});
  try {
    assert.equal((await save({kind:"status",action:"save",version:0,data:status,participantId:id(2)})).status,400);
    assert.equal((await save({kind:"status",action:"save",version:0,data:status})).status,200);
    const before=await control(); const home=await html(); const after=await control();
    assert(home.includes(status.phase)&&home.includes(status.goal));
    assert.equal(after.projectHomeRequests-before.projectHomeRequests,1,"Home status/events/notices share one request-scoped query");
    assert.equal((await save({kind:"status",action:"save",version:0,data:null})).status,409);
    const e=await save({kind:"event",action:"save",version:0,data:{title:"Synthetic event",startsAt:"2099-01-01T09:00:00+09:00",location:"TEST",description:"Synthetic only",href:"/board",isVisible:true}});
    assert.equal(e.status,200);const event=await e.json();assert((await html()).includes("Synthetic event"));
    assert.equal((await save({kind:"event",action:"delete",id:event.key,version:1})).status,200);assert(!(await html()).includes("Synthetic event"));
    let state=await(await manager.call("/api/admin/project")).json();const revision=state.revisions.find(r=>r.kind==="event"&&r.after_data.version===1);
    assert.equal((await save({kind:"event",action:"restore",id:event.key,version:2,historyId:revision.id})).status,200);assert((await html()).includes("Synthetic event"));
    const data={decidedOn:"2026-11-11",relatedPollSlugs:["land-priority","hidden"],isVisible:true,supersededBy:null};
    assert.equal((await save({kind:"decision",action:"save",id:"1",version:0,data})).status,404);
    assert.equal((await save({kind:"decision",action:"save",id:"90",version:0,data:{...data,relatedPollSlugs:["missing"]}})).status,400);
    assert.equal((await save({kind:"decision",action:"save",id:"90",version:0,data})).status,200);
    let h=await html();const section=h.match(/<section\b[^>]*data-home-section="decisions"[\s\S]*?<\/section>/)?.[0];
    assert(section.includes("2026-11-11")&&section.includes("/polls/land-priority"));assert(!section.includes("/polls/hidden"));assert(!h.includes("fixture-decision-body-not-for-home"));
    assert.equal((await save({kind:"decision",action:"save",id:"92",version:0,data:{...data,relatedPollSlugs:[]}})).status,200);
    assert.equal((await save({kind:"decision",action:"save",id:"90",version:1,data:{...data,supersededBy:"92"}})).status,200);
    assert.equal((await save({kind:"decision",action:"save",id:"92",version:1,data:{...data,supersededBy:"90"}})).status,400);
    state=await(await manager.call("/api/admin/project")).json();assert(state.revisions.every(r=>r.after_data.updated_by===id(1)));
    const simultaneous=await Promise.all([save({kind:"status",action:"save",version:1,data:null}),save({kind:"status",action:"save",version:1,data:status})]);
    assert.deepEqual(simultaneous.map(r=>r.status).sort(),[200,409]);
    await control({projectMode:"outage"});h=await html();assert(h.includes("프로젝트 현황을 불러오지 못했습니다"));assert(!h.includes("fixture-private-project-outage"));
  } finally {await control({projectMode:"missing"});}
  return ["Project admin API rejects anonymous/member/cross-origin/forged identity, validates CAS and records recoverable history", "Project status/events/explicit notices reach Home with one shared query; delete/restore and replacement cycles; hidden Poll/body stay private; missing schema differs from outage"];
}
