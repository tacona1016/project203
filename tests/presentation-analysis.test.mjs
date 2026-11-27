import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSnapshot, parseAllocation, REVIEW_POLL_IDS } from "../lib/presentation/poll-analysis.ts";
function fixture() {
 return {snapshot_at_utc:"2026-11-27T12:00:00Z",snapshot_at_kst:"2026-11-27 21:00:00",target_ids:[...REVIEW_POLL_IDS],audience:{registered:10,active:10,denominator:"registered"},polls:REVIEW_POLL_IDS.map(id=>({id,slug:"synthetic-"+id,title:"Synthetic",poll_type:"choice",vote_mode:"single",status:"CLOSED",visible:true,is_hidden:false,is_closed:false,results_visibility:"after_close",voting_ends_at:"2026-11-27T10:00:00Z",respondents:2,raw_response_count:2,max_choices_per_participant:null,options:[{id:id*10,label:"A",display_order:1,count:1},{id:id*10+1,label:"B",display_order:2,count:1}],allocation:null,validation:{wrong_option_rows:0,duplicate_active_rows:0,over_limit_respondents:0}}))};
}
test("allocation accepts four integer scores summing ten without repair",()=>{
 for(const s of ["4/3/2/1","2, 2, 3, 3","1 2 3 4"]) assert.equal(parseAllocation(s)?.reduce((a,b)=>a+b),10);
 for(const s of ["2/2/4/4","4/3/2","4/3/2/1/0","0/3/3/4","1.5/2/3/3.5","-1/3/4/4","2e0/2/3/3","+1/2/3/4"]) assert.equal(parseAllocation(s),null,s);
});
test("numbered lines separate question labels from scores and preserve question order",()=>{
 assert.deepEqual(parseAllocation("1. 4\n2. 3\n3. 1\n4. 2"),[4,3,1,2]);
 assert.deepEqual(parseAllocation("4) 2\r\n2) 3\r\n1) 4\r\n3) 1"),[4,3,1,2]);
});
test("numbered format rejects duplicate/missing labels, invalid scores and ambiguous extra numbers",()=>{
 for(const s of ["1. 4\n1. 3\n3. 1\n4. 2","1. 4\n2. 3\n3. 1","1. 4\n2. 3\n3. 1\n4. 2\n합계 10","1.4\n2.3\n3.1\n4.2","1. 1.5\n2. 3\n3. 1.5\n4. 4","1. 5\n2. 2\n3. 1\n4. 2","1. 4\n2. 4\n3. 4\n4. 4"]) assert.equal(parseAllocation(s),null);
});
test("analysis handles respondent denominators, ties and immutable source",()=>{
 const s=fixture(),before=structuredClone(s),result=analyzeSnapshot(s);
 assert.deepEqual(s,before); assert.equal(result.polls[0].participation_percentage,20);
 assert.deepEqual(result.polls[0].leaders,["A","B"]);assert.equal(result.polls[0].options[0].percentage,50);
});
test("multiple choice uses respondents, not total selections as denominator",()=>{
 const s=fixture();Object.assign(s.polls[1],{vote_mode:"multiple",max_choices_per_participant:2,raw_response_count:4});
 s.polls[1].options.forEach(o=>o.count=2);
 assert.equal(analyzeSnapshot(s).polls[1].options.reduce((a,o)=>a+o.percentage,0),200);
});
test("private and future results must be withheld instead of exported",()=>{
 const s=fixture();s.polls[0].is_hidden=true;assert.throws(()=>analyzeSnapshot(s),/publication/);
 Object.assign(s.polls[0],{visible:false,respondents:null,raw_response_count:null,options:null});
 assert.equal(analyzeSnapshot(s).polls[0].options,null);
 const future=fixture();future.polls[0].voting_ends_at="2099-01-01";assert.throws(()=>analyzeSnapshot(future));
});
test("reject wrong target set, malformed totals and canonical duplicates",()=>{
 for(const mutate of [s=>s.polls[0].id=6,s=>s.polls[0].raw_response_count=3,s=>s.polls[0].validation.duplicate_active_rows=1,s=>s.polls[0].options[1].id=s.polls[0].options[0].id]){
 const s=fixture();mutate(s);assert.throws(()=>analyzeSnapshot(s));
 }
});
test("score distributions independently verify SQL summary values",()=>{
 const s=fixture(),p=s.polls[3];
 Object.assign(p,{poll_type:"text",options:null,validation:null,allocation:{valid_count:2,invalid_count:0,duplicate_respondent_count:0,items:[2,2,3,3].map((n,i)=>({item:i+1,label:"항목 "+(i+1),mean:n,median:n,minimum:n,maximum:n,valid_n:2,population_standard_deviation:0,distribution:{[n]:2}}))}});
 assert.equal(analyzeSnapshot(s).polls[3].allocation.valid_count,2);
 p.allocation.items[0].mean=2.5;assert.throws(()=>analyzeSnapshot(s),/statistics/);
});
