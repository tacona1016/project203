// Local-only, authenticated review copy. Never deploy this ignored directory.
import { appendFile, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { openSync, closeSync } from "node:fs";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import path from "node:path";
import { installReviewRoutes } from "./presentation-review-routes.mjs";
const repo=process.cwd(), out=path.resolve(".verification/presentation-review"), appRoot=path.resolve(".verification/presentation-review-app");
const base="http://127.0.0.1:3210",backend="http://127.0.0.1:3212";
const id=randomUUID(),password=randomBytes(24).toString("base64url"),key=randomBytes(24).toString("hex");
const env={...process.env,NEXT_TELEMETRY_DISABLED:"1",NEXT_PUBLIC_SUPABASE_URL:backend,SUPABASE_SECRET_KEY:key,SITE_SESSION_SECRET:randomBytes(48).toString("hex"),BOARD_PARTICIPANT_PASSWORDS:JSON.stringify({[id]:password}),ADMIN_PASSWORD:randomBytes(24).toString("hex")};
delete env.SITE_ACCESS_PASSWORD;
const member={id,display_name:"검토 회원",is_active:true};
const server=createServer((req,res)=>{
 const url=new URL(req.url,backend);
 res.setHeader("Content-Type","application/json");res.setHeader("Cache-Control","no-store");
 if(req.method!=="GET"){res.writeHead(405);return res.end('{"message":"Read-only local review"}');}
 if(url.pathname==="/rest/v1/participants"&&req.headers.apikey===key){
  const single=String(req.headers.accept).includes("object+json");
  const match=!url.searchParams.get("id")||url.searchParams.get("id")==="eq."+id;
  return res.end(JSON.stringify(single?(match?member:null):[member]));
 }
 res.writeHead(503);res.end('{"message":"Only local review authentication directory is available"}');
});
await mkdir(appRoot,{recursive:true});
for(const name of ["app","components","data","lib","public","proxy.ts","mdx-components.tsx","next.config.mjs","tsconfig.json","package.json","postcss.config.mjs","next-env.d.ts"]) await cp(path.join(repo,name),path.join(appRoot,name),{recursive:true});
const reviewConfig=path.join(appRoot,"next.config.mjs");
await writeFile(reviewConfig,(await readFile(reviewConfig,"utf8")).replace("agentRules: false,","agentRules: false,\n  devIndicators: false,"));
await mkdir(path.join(appRoot,"review-private"),{recursive:true});
await cp(path.join(out,"data/poll-results-snapshot.json"),path.join(appRoot,"review-private/snapshot.json"));
await writeFile(path.join(appRoot,"review-data.ts"),'import "server-only";\nimport source from "./review-private/snapshot.json";\nimport {analyzeSnapshot,type PollSnapshot} from "@/lib/presentation/poll-analysis";\nconst snapshot=analyzeSnapshot(source as PollSnapshot);\nexport const time=snapshot.snapshot_at_kst;\nexport function getPoll(id:number){const p=snapshot.polls.find(p=>p.id===id);if(!p||!p.visible)throw Error("Unavailable result");return p;}\nexport function choiceRows(id:number,ranked=false){const p=getPoll(id);return [...(p.options??[])].sort((a,b)=>ranked?b.count-a.count:a.display_order-b.display_order).map(o=>({id:o.id,label:o.label,value:o.percentage??0,detail:o.count+"명 · "+o.percentage+"%",...(ranked?{rank:o.rank}:{})}));}\nexport function scoreRows(){return getPoll(11).allocation!.items.map(i=>({id:i.item,label:i.label,value:i.mean,detail:i.mean.toFixed(2)+" / 4점"}));}\n');
await appendFile(path.join(appRoot,"review-data.ts"), "\nexport const audience = snapshot.audience;\n");
const routes=path.join(appRoot,"app/presentation-review");
await installReviewRoutes(appRoot,out);
let original=await readFile("app/quarter/2026-q4/page.mdx","utf8");
original=original.replace('import { getQuarter, getQuarterMetadata } from "@/data/quarters";','import {ReviewOriginal} from "@/review-original";')
 .replace('<PresentationSurveyResults />','')
 .replace('export const metadata = getQuarterMetadata(getQuarter("2026-q4"));','')
 .replace(/<Presentation quarter=\{getQuarter\("2026-q4"\)\}(?: theme="devicebook")?>/,'<ReviewOriginal>')
 .replace('</Presentation>','</ReviewOriginal>')
 .replace(/<section id="comments"[\s\S]*?<\/section>/,"");
await mkdir(path.join(routes,"original"),{recursive:true});
await writeFile(path.join(routes,"original/page.mdx"),original);
await writeFile(path.join(appRoot,"review-original.tsx"),'import {PresentationNavigator} from "@/components/presentation/PresentationNavigator";import type{ReactNode}from"react";export function ReviewOriginal({children}:{children:ReactNode}){return <><PresentationNavigator/><main id="main-content" className="presentation">{children}</main></>;}\n');
// Synthetic review identity uses the normal password check/cookie/session code.
// No production password, cookie, secret or member identity is copied.
await writeFile(path.join(out,"review-access.local.json"),JSON.stringify({base,participantId:id,password,scope:"Synthetic localhost review only; not a production credential"},null,2));
const log=openSync(path.join(out,"review-server.log"),"w");
let child;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function stop(){if(child?.exitCode===null)child.kill();await new Promise(r=>server.close(r));closeSync(log);}
await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(3212,"127.0.0.1",resolve);});
child=spawn(process.execPath,[path.join(repo,"node_modules/next/dist/bin/next"),"dev","--port","3210","--hostname","127.0.0.1"],{cwd:appRoot,env,windowsHide:true,stdio:["ignore",log,log]});
process.on("SIGINT",()=>void stop().then(()=>process.exit()));process.on("SIGTERM",()=>void stop().then(()=>process.exit()));
for(let i=0;i<180;i++){try{if((await fetch(base+"/api/access/participants")).ok)break;}catch{}if(i===179){await stop();throw Error("Local review server startup failed; inspect ignored log");}await pause(500);}
console.log("Authenticated local review: "+base+"/presentation-review/existing#results-overview");
console.log("Local test access details are in the ignored review-access.local.json. No production authentication was changed.");
if(process.argv.includes("--browser")){
 try{const {runPresentationReview}=await import("../tests/integration/presentation-review-browser.mjs");await runPresentationReview({base,id,password,out});}finally{await stop();}
}
