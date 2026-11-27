import assert from "node:assert/strict";
import { mkdir,writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

export async function runPresentationRelease({a,anonymous,base,id,browser}) {
 const out=path.resolve(".verification/presentation-release");await mkdir(out,{recursive:true});
 const configure=body=>fetch("http://127.0.0.1:3102/_test",{method:"POST",body:JSON.stringify(body)});
 const route="/quarter/2026-q4",checks=[];
 const check=(name,value)=>{assert.ok(value,name);checks.push(name);};
 check("Anonymous published deck redirects",(await anonymous.call(route)).status===307);
 await configure({seedSurvey:true});
 let html=await(await a.call(route)).text();
 check("Published deck renders original twelve plus summary",(html.match(/data-presentation-section="true"/g)||[]).length===13);
 check("Summary uses live RPC aggregates",html.includes("data-poll-id=\"14\"")&&html.includes("설문 조사 결과")&&html.includes("2.50 / 4점"));
 check("Production chrome keeps members and comments",html.includes("name-current")&&html.includes('id="comments"')&&!html.includes("검토용 시안 · 운영 미반영"));
 for(const value of [id,"4/3/2/1","1. 1\\n2. 2","text_response"]){ // Own UUID can appear in session context; raw answers must never appear.
   if(value===id)continue;
   check("No individual response payload: "+value,!html.includes(value));
 }
 for(const change of [{is_hidden:true},{is_hidden:false,is_closed:false,results_visibility:"after_close",voting_ends_at:null}]){
   await configure({changePoll:{slug:"survey-9",...change}});html=await(await a.call(route)).text();
   check("Hidden/reopened result withholds entire summary",!html.includes("data-poll-id=")&&html.includes("공개 조건"));
 }
 await configure({seedSurvey:true,surveyFailure:true});html=await(await a.call(route)).text();
 check("Outage differs from empty/withheld results",html.includes("설문 결과를 불러오지 못했습니다.")&&!html.includes("data-poll-id="));
 await configure({surveyFailure:false});
 if(browser)await runChrome({base,cookies:[...a.cookies],out,check});
 await writeFile(path.join(out,"report.json"),JSON.stringify({status:"passed",scope:"Published route, synthetic DB protocol; no Production writes",checks},null,2));
 console.log("Published presentation release passed: "+checks.length+" checks");
}

async function runChrome({base,cookies,out,check}) {
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const chrome=spawn(process.env.BROWSER_BIN??"C:/Program Files/Google/Chrome/Application/chrome.exe",["--headless=new","--disable-gpu","--in-process-gpu","--no-sandbox","--no-first-run","--disable-background-networking","--remote-debugging-port=9233","--user-data-dir="+path.join(out,"chrome"),"about:blank"],{windowsHide:true,stdio:"ignore"});
 let socket;const errors=[];
 try {
  let tabs;for(let i=0;i<100;i++){try{tabs=await(await fetch("http://127.0.0.1:9233/json/list")).json();if(tabs.some(t=>t.type==="page"))break;}catch{}await pause(100);}
  socket=new WebSocket(tabs.find(t=>t.type==="page").webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener("open",r,{once:true}));
  let seq=0;const pending=new Map();
  socket.addEventListener("message",({data})=>{const message=JSON.parse(data);if(message.method==="Runtime.exceptionThrown")errors.push("browser exception");if(message.id&&pending.has(message.id)){const p=pending.get(message.id);pending.delete(message.id);clearTimeout(p.timer);if(message.error)p.reject(Error("CDP error"));else p.resolve(message.result);}});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++seq;pending.set(n,{resolve,reject,timer:setTimeout(()=>reject(Error("CDP timeout "+method)),20000)});socket.send(JSON.stringify({id:n,method,params}));});
  const evaluate=async expression=>{const r=await send("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error("Browser evaluation failed");return r.result.value;};
  const wait=async exp=>{for(let i=0;i<200;i++){try{if(await evaluate(exp))return;}catch{}await pause(100);}throw Error("Browser did not settle: "+exp);};
  await send("Page.enable");await send("Runtime.enable");await send("Network.enable");await send("Network.clearBrowserCookies");
  // Reuse the normal HTTP-login session in memory; no cookie artifacts or synthetic signing.
  for(const [name,value]of cookies)await send("Network.setCookie",{name,value,url:base,httpOnly:true,sameSite:"Lax"});
  const measurements=[];
  for(const [width,height]of [[390,900],[768,1024],[1440,1000],[1920,1080]]) {
   await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:false});
   await send("Page.navigate",{url:base+"/quarter/2026-q4#results-overview"});
   await wait("document.readyState==='complete'&&document.querySelector('.presentation-position')?.textContent.includes('/ 13')&&!!document.querySelector('[data-poll-id]')");await pause(350);
   check("13 sections at "+width,await evaluate("document.querySelectorAll('[data-presentation-section]').length===13"));
   check("Summary last at "+width,await evaluate("Array.from(document.querySelectorAll('[data-presentation-section]')).at(-1).id==='results-overview'"));
   check("No horizontal overflow at "+width,await evaluate("document.documentElement.scrollWidth<=innerWidth+1"));
   check("Confirmed score labels at "+width,await evaluate("['거리(접근성)','토지 넓이','주변 환경','건축시기'].every(s=>document.querySelector('[data-poll-id=\"11\"]').textContent.includes(s))"));
   await evaluate("document.querySelector('.presentation-toc-toggle').click();document.querySelector('.presentation-toc a[href=\"#results-overview\"]').click()");
   await wait("document.querySelector('.presentation-position').textContent.replace(/\\s/g,'')==='13/13'");
   check("TOC reaches 13 at "+width,true);
   const measurement=await evaluate("(()=>{const r=document.querySelector('#results-overview').getBoundingClientRect();return {width:innerWidth,height:innerHeight,slideHeight:r.height,top:r.top,bottom:r.bottom}})()");measurements.push(measurement);
   await writeFile(path.join(out,"measurements.json"),JSON.stringify(measurements,null,2));
   check("Summary clears sticky header at "+width,measurement.top>=110);
   if(width>=1440)check("Summary fits desktop at "+width,measurement.bottom<=height+1);
   const screenshot=await send("Page.captureScreenshot",{format:"png"});await writeFile(path.join(out,`published-${width}.png`),Buffer.from(screenshot.data,"base64"));
  }
  await evaluate("document.querySelector('.presentation-mode-toggle').click()");await wait("document.querySelector('.presentation-theme').dataset.mode==='presentation'");
  check("Presentation hides member chrome and comments",await evaluate("getComputedStyle(document.querySelector('.site-header')).display==='none'&&getComputedStyle(document.querySelector('#comments')).display==='none'"));
  check("Only final summary visible",await evaluate("Array.from(document.querySelectorAll('[data-presentation-section]')).filter(e=>getComputedStyle(e).display!=='none').map(e=>e.id).join()==='results-overview'"));
  await send("Input.dispatchKeyEvent",{type:"keyDown",key:"ArrowLeft",code:"ArrowLeft"});await wait("document.querySelector('#preferences').dataset.deckActive==='true'");
  await send("Input.dispatchKeyEvent",{type:"keyDown",key:"ArrowRight",code:"ArrowRight"});await wait("document.querySelector('#results-overview').dataset.deckActive==='true'");
  const native=await evaluate("!!document.fullscreenElement");if(native)await evaluate("document.exitFullscreen()");else await send("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape"});
  await wait("document.querySelector('.presentation-theme').dataset.mode==='reading'");
  check("Reading restores member chrome",await evaluate("getComputedStyle(document.querySelector('.site-header')).display!=='none'"));
  check("No browser exceptions",errors.length===0);
  await writeFile(path.join(out,"measurements.json"),JSON.stringify(measurements,null,2));
 } finally { if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({id:999999,method:"Browser.close"}));await pause(400);socket.close();}if(chrome.exitCode===null)chrome.kill(); }
}
