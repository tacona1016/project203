import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdir,writeFile,readFile} from "node:fs/promises";
import path from "node:path";
export async function runPresentationReview({base,id,password,out}){
 const snapshot=JSON.parse(await readFile(path.join(out,"data/poll-results-snapshot.json"),"utf8"));
 const pause=ms=>new Promise(r=>setTimeout(r,ms)),checks=[],measurements=[],errors=[];
 const browser=spawn(process.env.BROWSER_BIN??"C:/Program Files/Google/Chrome/Application/chrome.exe",["--headless=new","--disable-gpu","--in-process-gpu","--no-sandbox","--no-first-run","--no-default-browser-check","--disable-background-networking","--remote-debugging-port=9232","--user-data-dir="+path.join(out,"chrome-profile"),"about:blank"],{windowsHide:true,stdio:"ignore"});
 let socket;
 const check=(name,value)=>{assert.ok(value,name);checks.push(name);};
 try{
 let tabs;for(let i=0;i<100;i++){try{tabs=await(await fetch("http://127.0.0.1:9232/json/list")).json();if(tabs.some(t=>t.type==="page"))break;}catch{}await pause(100);}
 socket=new WebSocket(tabs.find(t=>t.type==="page").webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener("open",r,{once:true}));
 let seq=0;const pending=new Map();
 socket.addEventListener("message",({data})=>{const m=JSON.parse(data);if(m.method==="Runtime.exceptionThrown")errors.push("Uncaught browser exception");if(m.method==="Runtime.consoleAPICalled"&&m.params.type==="error"&&m.params.args?.some(a=>/hydration|did not match/i.test(a.value??"")))errors.push("Hydration error");if(m.id&&pending.has(m.id)){const p=pending.get(m.id);clearTimeout(p.timer);pending.delete(m.id);if(m.error)p.reject(Error("CDP "+p.method));else p.resolve(m.result);}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++seq;pending.set(n,{resolve,reject,method,timer:setTimeout(()=>reject(Error("CDP timeout "+method)),20000)});socket.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async expression=>{const result=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(result.exceptionDetails)throw Error("Browser evaluation failed");return result.result.value;};
 const wait=async exp=>{for(let i=0;i<200;i++){try{if(await evaluate(exp))return;}catch{}await pause(100);}throw Error("Browser did not settle");};
 let navigationSequence=0;
 const go=async name=>{
   const marker=Date.now()+"-"+(++navigationSequence);
   await evaluate("window.presentationReviewNavigation="+JSON.stringify(marker));
   const navigation=await send("Page.navigate",{url:base+"/presentation-review/"+name});
   await wait((navigation.loaderId?"window.presentationReviewNavigation!=="+JSON.stringify(marker)+"&&":"")+"document.readyState==='complete'&&document.querySelectorAll('[data-presentation-section]').length>0");
   await pause(300);
 };
 await send("Page.enable");await send("Runtime.enable");await send("Network.enable");
 await send("Network.clearBrowserCookies");
 const unauth=await fetch(base+"/presentation-review/existing",{redirect:"manual"});
 check("Anonymous combined deck redirects to login",unauth.status===307&&unauth.headers.get("location")?.startsWith("/access"));
 check("Anonymous response contains no survey results",!(await unauth.text()).includes("data-poll-id"));
 for(const file of ["/review-private/snapshot.json","/data/poll-results-snapshot.json"])check("No public snapshot "+file,(await fetch(base+file,{redirect:"manual"})).status!==200);
 await send("Page.navigate",{url:base+"/access"});await wait("document.readyState==='complete'&&!!document.querySelector('input[name=password]')");
 check("Normal local test login",await evaluate("fetch('/api/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify("+JSON.stringify({participantId:id,password,next:"/presentation-review/existing"})+")}).then(r=>r.status)")===200);
 const original=await readFile("app/quarter/2026-q4/page.mdx","utf8");
 const originalIds=[...original.matchAll(/<Slide id="([^"]+)"/g)].map(m=>m[1]);
 const output=path.join(out,"screenshots/integrated");await mkdir(output,{recursive:true});
 for(const [width,height]of [[390,900],[768,1024],[1440,1000],[1920,1080]]){
   await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:false});
   await go("original");
   check("Original remains twelve slides at "+width,await evaluate("document.querySelectorAll('[data-presentation-section]').length===12"));
   await go("existing");
   await evaluate("Promise.all(Array.from(document.images).map(i=>{i.loading='eager';return i.decode().catch(()=>undefined)}))");
   await wait("document.querySelector('.presentation-position').textContent.includes('/ 13')");
   const ids=await evaluate("Array.from(document.querySelectorAll('[data-presentation-section]')).map(e=>e.id)");
   check("Original twelve section order preserved at "+width,JSON.stringify(ids.slice(0,12))===JSON.stringify(originalIds));
   check("Survey is unique final thirteenth slide at "+width,ids.length===13&&ids[12]==="results-overview");
   check("No retired detail links at "+width,await evaluate("!document.querySelector('a[href*=\"results-detail\"]')&&!document.body.textContent.includes('상세 10장')"));
   check("No horizontal overflow at "+width,await evaluate("document.documentElement.scrollWidth<=innerWidth+1"));
   check("Images load at "+width,await evaluate("Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)"));
   check("Summary numbered 13 at "+width,await evaluate("document.querySelector('#results-overview').dataset.sectionNumber==='13'"));
   check("Survey heading at "+width,await evaluate("document.querySelector('.compact-overview-heading h2').textContent==='설문 조사 결과'"));
   const pollIds=await evaluate("Array.from(document.querySelectorAll('[data-poll-id]')).map(e=>Number(e.dataset.pollId)).sort((a,b)=>a-b)");
   check("Seven target polls at "+width,JSON.stringify(pollIds)===JSON.stringify(snapshot.target_ids));
   for(const poll of snapshot.polls){
     const text=await evaluate("document.querySelector('[data-poll-id=\""+poll.id+"\"]').textContent");
     if(poll.options)for(const option of poll.options){
       check("Option "+poll.id+"/"+option.id+" label at "+width,text.includes(option.label));
       check("Option "+poll.id+"/"+option.id+" count at "+width,option.count ? text.includes(option.count+"명 · "+option.percentage+"%") : text.includes("0명"));
     }else{
       check("All valid score responses at "+width,text.includes("유효 "+poll.allocation.valid_count+"건"));
       for(const item of poll.allocation.items)check("Score "+item.item+" label and mean at "+width,text.includes(item.label)&&text.includes(item.mean.toFixed(2)+" / 4점"));
     }
   }
   await evaluate("document.querySelector('.presentation-toc-toggle').click();document.querySelector('.presentation-toc a[href=\"#results-overview\"]').click()");
   await wait("document.querySelector('.presentation-position').textContent.replace(/\\s/g,'')==='13/13'");
   check("TOC and anchor reach last slide at "+width,await evaluate("location.hash==='#results-overview'&&document.querySelector('.presentation-toc a[aria-current]').getAttribute('href')==='#results-overview'"));
   check("Next disabled on last slide at "+width,await evaluate("document.querySelector('[aria-label=\"다음 섹션\"]').disabled"));
   const frame=await evaluate("(()=>{const r=document.querySelector('#results-overview').getBoundingClientRect();return {width:innerWidth,height:innerHeight,slideHeight:r.height,top:r.top,bottom:r.bottom,scrollWidth:document.documentElement.scrollWidth}})()");
   if(width>=1440)check("Summary fits desktop viewport at "+width,frame.slideHeight<=height-90&&frame.bottom<=height+1);
   measurements.push(frame);
   const screenshot=await send("Page.captureScreenshot",{format:"png"});
   await writeFile(path.join(output,"last-slide-"+width+".png"),Buffer.from(screenshot.data,"base64"));
   if(width<1000){
     const scroll=await evaluate("scrollY");
     const summaryTop=await evaluate("document.querySelector('#results-overview').getBoundingClientRect().top+scrollY");
     for(const [label,top]of [["middle",summaryTop+height*0.7],["bottom",Infinity]]){
       await evaluate("window.scrollTo(0,"+(Number.isFinite(top)?top:"document.documentElement.scrollHeight")+")");
       await pause(100);
       const portion=await send("Page.captureScreenshot",{format:"png"});
       await writeFile(path.join(output,"last-slide-"+label+"-"+width+".png"),Buffer.from(portion.data,"base64"));
     }
     await evaluate("window.scrollTo(0,"+scroll+")");
   }
   await evaluate("document.querySelector('[aria-label=\"이전 섹션\"]').click()");
   await wait("document.querySelector('.presentation-position').textContent.replace(/\\s/g,'')==='12/13'");
   check("Previous returns to original final slide at "+width,await evaluate("location.hash==='#preferences'"));
   await evaluate("document.querySelector('[aria-label=\"다음 섹션\"]').click()");
   await wait("document.querySelector('.presentation-position').textContent.replace(/\\s/g,'')==='13/13'");
 }
 await send("Emulation.setDeviceMetricsOverride",{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
 await evaluate("document.querySelector('.presentation-mode-toggle').click()");
 await wait("document.querySelector('.presentation-theme').dataset.mode==='presentation'");
 check("Presentation shows only summary at position13",await evaluate("Array.from(document.querySelectorAll('[data-presentation-section]')).filter(e=>getComputedStyle(e).display!=='none').map(e=>e.id).join()==='results-overview'"));
 check("Summary fits presentation viewport",await evaluate("(()=>{const m=document.querySelector('main.presentation');return m.scrollHeight<=m.clientHeight+1;})()"));
 await send("Input.dispatchKeyEvent",{type:"keyDown",key:"ArrowLeft",code:"ArrowLeft"});
 await wait("document.querySelector('#preferences').dataset.deckActive==='true'");
 check("Keyboard previous reaches original slide12",true);
 await send("Input.dispatchKeyEvent",{type:"keyDown",key:"ArrowRight",code:"ArrowRight"});
 await wait("document.querySelector('#results-overview').dataset.deckActive==='true'");
 check("Keyboard next returns to summary13",true);
 const nativeFullscreen=await evaluate("!!document.fullscreenElement");
 if(nativeFullscreen)await evaluate("document.exitFullscreen()");else await send("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape"});
 await wait("document.querySelector('.presentation-theme').dataset.mode==='reading'");
 check("Reading mode restores all thirteen slides",await evaluate("Array.from(document.querySelectorAll('[data-presentation-section]')).every(e=>getComputedStyle(e).display!=='none')"));
 await go("existing");
 await go("results");
 await wait("location.pathname==='/presentation-review/existing'&&location.hash==='#results-overview'");
 check("Legacy summary address redirects to appended slide",true);
 check("Ten-slide route removed",await evaluate("fetch('/presentation-review/results-detail').then(r=>r.status)")===404);
 check("No uncaught or hydration errors",errors.length===0);
 await writeFile(path.join(out,"review/integrated-browser-report.json"),JSON.stringify({status:"passed",scope:"Actual Chrome; protected local review and fixed aggregate snapshot; no production writes",checks,measurements,errors,nativeFullscreen},null,2));
 console.log("Integrated 13-slide Chrome review passed: "+checks.length+" checks.");
 }finally{
 if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({id:999999,method:"Browser.close"}));await pause(500);socket.close();}
 if(browser.exitCode===null)browser.kill();
 }
}
if(process.argv.includes("--connect")){
 const out=path.resolve(".verification/presentation-review"),access=JSON.parse(await readFile(path.join(out,"review-access.local.json"),"utf8"));
 await runPresentationReview({base:access.base,id:access.participantId,password:access.password,out});
}
