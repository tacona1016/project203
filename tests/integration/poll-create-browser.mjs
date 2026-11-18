import assert from "node:assert/strict";
import {writeFile} from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
export async function runPollCreateBrowser({page,output,adminPassword}){
  const checks=[],measurements=[];
  const control=async body=>(await fetch("http://127.0.0.1:3102/_test",{method:"POST",body:JSON.stringify(body)})).json();
  assert.equal(await page.evaluate(`fetch('/api/admin/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:${JSON.stringify(adminPassword)}})}).then(r=>r.status)`),200);
  const files=[];for(let i=0;i<4;i++){const file=path.join(output,`create-photo-${i}.png`);await sharp({create:{width:220,height:130,channels:3,background:["#2453df","#448855","#ccbbaa","#664488"][i]}}).png().toFile(file);files.push(file);}
  async function select(selector,paths){const dom=await page.send("DOM.getDocument"),found=await page.send("DOM.querySelector",{nodeId:dom.root.nodeId,selector});assert(found.nodeId,selector);await page.send("DOM.setFileInputFiles",{nodeId:found.nodeId,files:paths});}
  async function form(title){
    await page.go("/admin/polls");
    await page.wait("Array.from(document.querySelectorAll('a[href=\"/admin/polls/new\"]')).some(a=>Object.keys(a).some(key=>key.startsWith('__reactProps')))");
    await page.evaluate("document.querySelector('a[href=\"/admin/polls/new\"]').click()");
    await page.wait("location.pathname==='/admin/polls/new'&&!!document.querySelector('.admin-form > fieldset')&&!document.querySelector('.admin-form > fieldset').disabled");
    await page.evaluate(`(()=>{window._made=0;window._sent=[];window._urls=[];window._revoked=[];window._hold=false;window._lost=false;const original=window.fetch;window.fetch=async(input,init)=>{const u=new URL(typeof input==='string'?input:input.url,location.href);if(init?.method==='POST'&&u.pathname==='/api/admin/polls'){window._made++;window._createdBody=JSON.parse(init.body);const r=await original(input,init);if(window._lost&&r.ok)throw Error('fixture lost create ACK');return r;}if(init?.method==='POST'&&u.pathname.endsWith('/images')){window._sent.push(init.headers['Idempotency-Key']);if(window._hold)await new Promise(resolve=>window._release=resolve);}return original(input,init);};const make=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=file=>{const value=make(file);window._urls.push(value);return value;};URL.revokeObjectURL=url=>{window._revoked.push(url);revoke(url);};for(const [selector,value]of [['#poll-title',${JSON.stringify(title)}],['#poll-option-0','같은 후보'],['#poll-option-1','같은 후보']]){const el=document.querySelector(selector);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));}})()`);
  }
  const question="[aria-label=\"질문 이미지\"] input[type=file]";
  for(const width of process.argv.includes("--create-back-only")?[390]:[320,390,430,768,1440]){
    await page.send("Emulation.setDeviceMetricsOverride",{width,height:960,deviceScaleFactor:1,mobile:width<768});
    const title=`Create Chrome ${width}`;await form(title);
    if(width===320){await select(question,files);await page.wait("document.querySelector('[role=alert]')?.textContent.includes('최대 3장')");assert.equal(await page.evaluate("document.querySelectorAll('.poll-draft-preview').length"),0);}
    await select(question,files.slice(0,3));await page.wait("document.querySelectorAll('[aria-label=\"질문 이미지\"] .poll-draft-preview').length===3");
    const beforeOrder=await page.evaluate("Array.from(document.querySelectorAll('[aria-label=\"질문 이미지\"] [data-draft-image-id]')).map(e=>e.dataset.draftImageId)");
    await page.evaluate("Array.from(document.querySelectorAll('[aria-label=\"질문 이미지\"] button')).find(b=>b.textContent==='뒤로').click()");
    const questionIds=await page.evaluate("Array.from(document.querySelectorAll('[aria-label=\"질문 이미지\"] [data-draft-image-id]')).map(e=>e.dataset.draftImageId)");assert.deepEqual(questionIds,[beforeOrder[1],beforeOrder[0],beforeOrder[2]]);
    await select(".option-editor:nth-child(1) input[type=file]",[files[0]]);
    await page.evaluate("Array.from(document.querySelectorAll('.admin-form button')).find(b=>b.textContent.includes('+ 선택지 추가')).click()");
    await page.wait("document.querySelectorAll('.option-editor').length===3");
    await page.evaluate("(()=>{const el=document.querySelector('#poll-option-2');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'같은 후보');el.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await select(".option-editor:nth-child(3) input[type=file]",[files[1]]);
    const kept=await page.evaluate("document.querySelectorAll('.option-editor')[2].dataset.clientKey");
    await page.evaluate("document.querySelector('[aria-label=\"선택지 2 제거\"]').click()");
    assert.equal(await page.evaluate("document.querySelectorAll('.option-editor')[1].dataset.clientKey"),kept);
    const ids=await page.evaluate("Array.from(document.querySelectorAll('.option-editor')).map(e=>e.querySelector('[data-draft-image-id]')?.dataset.draftImageId)");
    await page.wait("Array.from(document.querySelectorAll('.poll-draft-preview')).every(img=>img.complete&&img.naturalWidth>0)");
    assert.equal(await page.evaluate("window._made"),0);assert.equal(await page.evaluate("window._sent.length"),0);
    if(width===390){
      await page.evaluate("window._backOriginalPath=location.href;window._popEvents=[];window.addEventListener('popstate',()=>window._popEvents.push({url:location.href,keys:Object.keys(history.state??{})}),true)");
      await page.evaluate("window._confirmBefore=window.confirm;window._backPrompt=false;window.confirm=()=>{window._backPrompt=true;return false;};history.back()");
      try{await page.wait("window._backPrompt&&location.pathname==='/admin/polls/new'&&document.querySelectorAll('.poll-draft-preview').length===5");}
      catch(error){await writeFile(path.join(output,"create-back-diagnostic.json"),JSON.stringify(await page.evaluate("({path:location.href,original:window._backOriginalPath,prompt:window._backPrompt,events:window._popEvents,previews:document.querySelectorAll('.poll-draft-preview').length,h1:document.querySelector('h1')?.textContent,historyLength:history.length,stateKeys:Object.keys(history.state??{})})"),null,2));throw error;}
      await page.evaluate("window.confirm=window._confirmBefore");assert.equal(await page.evaluate("window._made"),0);
    }
    assert.equal(await page.evaluate("document.documentElement.scrollWidth>innerWidth"),false,`Draft overflow ${width}`);
    await page.evaluate("window._hold=true;document.querySelector('.admin-form').requestSubmit();document.querySelector('.admin-form').requestSubmit()");
    await page.wait("window._sent.length===1&&!!window._release");
    assert.equal(await page.evaluate("window._made"),1);assert.equal(await page.evaluate("window._createdBody.is_hidden"),true);assert(await page.evaluate("document.querySelector('.admin-form > fieldset').disabled"));
    const slug=await page.evaluate("new URL(location.href).searchParams.get('resume')");const mid=await control({});assert(mid.polls.find(p=>p.slug===slug).is_hidden);
    await page.evaluate("window._hold=false;window._release()");
    await page.wait("location.pathname.startsWith('/admin/polls/poll-')&&!location.pathname.endsWith('/edit')&&document.body.textContent.includes('첨부 사진 5개')");
    await page.wait("Array.from(document.querySelectorAll('.poll-image-gallery img')).filter(img=>img.getBoundingClientRect().top<innerHeight&&img.getBoundingClientRect().bottom>0).every(img=>img.complete&&img.naturalWidth>0)");
    await page.evaluate("document.querySelector('.poll-results').scrollIntoView()");
    await page.wait("Array.from(document.querySelectorAll('.poll-results .poll-image-gallery img')).length===2&&Array.from(document.querySelectorAll('.poll-results .poll-image-gallery img')).every(img=>img.complete&&img.naturalWidth>0)");
    await page.evaluate("window.scrollTo(0,0)");
    const state=await control({}),poll=state.polls.find(p=>p.slug===slug),options=state.options.filter(o=>o.poll_id===poll.id).sort((a,b)=>a.display_order-b.display_order),images=state.pollImages.filter(i=>i.poll_id===poll.id&&i.state==="ready");
    assert(!poll.is_hidden);assert.equal(images.length,5);assert.deepEqual(images.filter(i=>i.option_id===null).sort((a,b)=>a.sort_order-b.sort_order).map(i=>i.id),questionIds);
    ids.forEach((id,index)=>assert.equal(String(images.find(i=>i.id===id).option_id),String(options[index].id)));
    assert.equal(await page.evaluate("window._made"),1);assert(await page.evaluate("window._urls.every(url=>window._revoked.includes(url))"),"All Object URLs revoked on completion/unmount");
    assert.equal(await page.evaluate("document.documentElement.scrollWidth>innerWidth"),false,`Detail overflow ${width}`);
    const screenshot=await page.send("Page.captureScreenshot",{format:"png"});await writeFile(path.join(output,`poll-create-${width}.png`),Buffer.from(screenshot.data,"base64"));
    measurements.push({width,preview:true,selectionOnlyNoRequests:true,createdOnce:true,questionPhotos:3,optionPhotos:2,exactOptionIDs:true,temporaryHidden:true,publishedAfterReady:true,objectUrlsRevoked:true,overflow:false});
  }
  if(process.argv.includes("--create-back-only"))return ["focused back navigation"];
  checks.push("Five viewports: file previews before any request, question reorder, duplicate labels/middle removal with stable keys, one create and 5 sequential images, ready-before-public, final detail galleries, Object URL cleanup, no overflow");
  await form("Create Chrome retry");await select(question,[files[0],files[1]]);await select(".option-editor:nth-child(1) input[type=file]",[files[0]]);await control({pollImageFailures:{upload:1}});
  await page.evaluate("document.querySelector('.admin-form').requestSubmit()");await page.wait("!!document.querySelector('[aria-label=\"투표 생성 진행\"] [role=alert]')");
  assert.equal(await page.evaluate("window._made"),1);const slug=await page.evaluate("new URL(location.href).searchParams.get('resume')");assert((await control({})).polls.find(p=>p.slug===slug).is_hidden);
  const count=await page.evaluate("window._sent.length");await control({agePollImages:true});await page.evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('실패한 이미지 재시도')).click()");
  await page.wait("document.body.textContent.includes('첨부 사진 3개')&&location.pathname.startsWith('/admin/polls/poll-')");assert.equal(await page.evaluate("window._made"),1);assert.equal(await page.evaluate("window._sent.length"),count+1);
  checks.push("Actual UI partial failure retains hidden created poll and successful images; retry posts only one failed file, never another poll");
  await form("Create Chrome lost ACK");await select(question,[files[0]]);await page.evaluate("window._lost=true;document.querySelector('.admin-form').requestSubmit()");await page.wait("document.querySelector('[role=alert]')?.textContent.includes('중복 생성')");await page.evaluate("document.querySelector('.admin-form').requestSubmit()");assert.equal(await page.evaluate("window._made"),1);
  await page.send("Page.reload");await page.wait("document.body.textContent.includes('생성 응답이 불확실')&&document.querySelector('.admin-form > fieldset').disabled");
  checks.push("Lost committed create ACK blocks second POST; reload marker disables new creation and directs operator to confirm list");
  await form("Create Chrome reload known");await select(question,[files[0]]);await control({pollImageFailures:{upload:1}});await page.evaluate("document.querySelector('.admin-form').requestSubmit()");await page.wait("!!document.querySelector('[aria-label=\"투표 생성 진행\"] [role=alert]')");const known=await page.evaluate("new URL(location.href).searchParams.get('resume')");await page.send("Page.reload");await page.wait("document.body.textContent.includes('사진 초안이 사라졌습니다.')");assert(await page.evaluate(`!!document.querySelector('a[href="/admin/polls/${known}/edit"]')&&document.querySelector('.admin-form > fieldset').disabled`));
  checks.push("Known slug survives reload without persisting File/Base64; resume link points to that existing edit page");
  await form("Create Chrome type switch");await select(".option-editor:nth-child(1) input[type=file]",[files[0]]);
  await page.evaluate("window._confirmCount=0;window.confirm=()=>{window._confirmCount++;return false;};document.querySelectorAll('input[name=poll-type]')[1].click()");assert.equal(await page.evaluate("document.querySelectorAll('.option-editor .poll-draft-preview').length"),1);
  await page.evaluate("window.confirm=()=>{window._confirmCount++;return true;};document.querySelectorAll('input[name=poll-type]')[1].click()");await page.wait("document.querySelectorAll('.option-editor').length===0");assert.equal(await page.evaluate("window._confirmCount"),2);assert(await page.evaluate("window._urls.every(url=>window._revoked.includes(url))"));
  await select(question,[files[2]]);await page.evaluate("document.querySelector('.admin-form').requestSubmit()");await page.wait("location.pathname.startsWith('/admin/polls/poll-')&&document.body.textContent.includes('첨부 사진 1개')");
  checks.push("Choice-to-text switch asks before dropping photos, supports cancel, revokes URLs and creates text poll with question image in one click");
  await writeFile(path.join(output,"poll-create-measurements.json"),JSON.stringify(measurements,null,2));return checks;
}
