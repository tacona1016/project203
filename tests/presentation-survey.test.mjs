import test from "node:test";
import assert from "node:assert/strict";
import { buildSurveyOverview, publicSurveyTargets, summarizeAllocation } from "../lib/presentation/survey-overview.ts";
const ids = [1,9,10,11,12,13,14];
function fixture() {
 const catalog=ids.map(id=>({poll:{id,slug:`synthetic-${id}`,quarter:"2026-q4",title:"Synthetic",poll_type:id===11?"text":"choice",vote_mode:"single",is_hidden:false,results_visibility:"after_close",updated_at:"2026-01-01"},status:"CLOSED",server_time:"2026-01-01T12:00:00Z",results:{counts:id===11?{}:{[id*10]:1,[id*10+1]:1},total_votes:2,participant_count:2,eligible_participant_count:10}}));
 const options=ids.filter(id=>id!==11).flatMap(id=>[0,1].map(i=>({id:id*10+i,poll_id:id,label:`Synthetic ${i}`,display_order:i})));
 const detail={...structuredClone(catalog[3]),responses:[{participant_id:"synthetic-member-one",participant_name:"PRIVATE_NAME",text_response:"4/3/2/1"},{participant_id:"synthetic-member-two",participant_name:"PRIVATE_NAME",text_response:"1. 1\n2. 2\n3. 3\n4. 4"}]};
 return {catalog,options,detail};
}
test("published RPC aggregates use DB time and registered denominator, never identities/raw text",()=>{
 const {catalog,options,detail}=fixture(),data=buildSurveyOverview(catalog,options,detail),json=JSON.stringify(data);
 assert.equal(data.polls.length,7);assert.equal(data.polls[0].participation_percentage,20);assert.equal(data.polls[0].options[0].percentage,50);
 assert.equal(data.snapshot_at_utc,catalog[0].server_time);assert.match(data.snapshot_at_kst,/KST$/);
 for(const secret of ["PRIVATE_NAME","synthetic-member","4/3/2/1","text_response","participant_id"])assert.equal(json.includes(secret),false);
 assert.deepEqual(data.polls[3].allocation.items.map(i=>i.label),["거리(접근성)","토지 넓이","주변 환경","건축시기"]);
 assert.equal(data.polls[3].allocation.valid_count,2);
});
test("missing, hidden, reopened, unpublished or wrong-quarter targets withhold entire summary",()=>{
 for(const mutate of [c=>c.pop(),c=>c[0].poll.is_hidden=true,c=>c[0].status="ACTIVE",c=>c[0].results=null,c=>c[0].poll.quarter="2027-q1"]){const {catalog}=fixture();mutate(catalog);assert.equal(publicSurveyTargets(catalog),null);}
});
test("invalid totals, missing options/denominator, text metadata race and duplicates fail closed",()=>{
 for(const mutate of [f=>f.catalog[0].results.total_votes=3,f=>f.options.shift(),f=>delete f.catalog[0].results.eligible_participant_count,f=>f.detail.poll.updated_at="changed",f=>f.detail.responses.push(f.detail.responses[0]),f=>f.catalog[0].results.counts[999]=1,f=>f.catalog[0].results.participant_count=11]){const f=fixture();mutate(f);assert.throws(()=>buildSurveyOverview(f.catalog,f.options,f.detail));}
});
test("valid zero responses remain zero; invalid text is excluded without repair",()=>{
 const f=fixture();for(const s of f.catalog){s.results.counts={};s.results.total_votes=0;s.results.participant_count=0;}f.detail={...f.catalog[3],responses:[]};
 assert.equal(buildSurveyOverview(f.catalog,f.options,f.detail).polls[0].respondents,0);
 const a=summarizeAllocation([{participant_id:"a",text_response:"4/3/2/1"},{participant_id:"b",text_response:"4/4/4/4"}]);assert.equal(a.valid_count,1);assert.equal(a.invalid_count,1);
});
