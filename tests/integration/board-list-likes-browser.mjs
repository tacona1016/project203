import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export async function runBoardListLikeBrowser({ page, base, output, id, bPassword, adminPassword }) {
  assert.equal(new URL(base).hostname,"127.0.0.1");
  const api=(route,method="GET",body)=>page.evaluate(`fetch(${JSON.stringify(route)},{method:${JSON.stringify(method)},cache:'no-store',${body===undefined?"":`headers:{'Content-Type':'application/json'},body:JSON.stringify(${JSON.stringify(body)})`}}).then(async r=>({status:r.status,data:await r.json()}))`);
  const control=body=>fetch("http://127.0.0.1:3103/_test",{method:"POST",body:JSON.stringify(body)});
  assert.equal((await api("/api/admin/access","POST",{password:adminPassword})).status,200);
  const input={title:"List Chrome 좋아요 정렬과 제목 말줄임 확인 ".repeat(4),content:"Synthetic list only",post_type:"general",is_pinned:false};
  const liked=await api("/api/board/posts","POST",input);assert.equal(liked.status,200);
  const zero=await api("/api/board/posts","POST",{...input,title:"List Chrome old post"});assert.equal(zero.status,200);
  const pin=await api("/api/board/posts","POST",{...input,title:"List Chrome 고정 공지",post_type:"notice",is_pinned:true});assert.equal(pin.status,200);
  await control({changePost:{id:zero.data.id,created_at:"2000-01-01T00:00:00Z"}});
  // A distinct fake member's HTTP session never replaces Chrome's member A.
  const login=await fetch(base+"/api/access",{method:"POST",headers:{Origin:base,"Content-Type":"application/json"},body:JSON.stringify({participantId:id(2),password:bPassword,next:"/board"})});assert.equal(login.status,200);
  const cookie=login.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
  for(const post of [liked.data.id,pin.data.id])assert.equal((await fetch(`${base}/api/board/posts/${post}/like`,{method:"PUT",headers:{Origin:base,Cookie:cookie}})).status,200);
  const row=post=>`Array.from(document.querySelectorAll('.board-row')).find(row=>row.getBoundingClientRect().height>0&&row.querySelector('.board-row-title').getAttribute('href').startsWith('/board/${post}?'))`;
  const count=post=>`${row(post)}?.querySelector('.board-like-count')?.getAttribute('aria-label')`;
  const route="/board?q=List+Chrome";
  const measurements=[];
  for(const width of [390,768,1440]){
    await page.send("Emulation.setDeviceMetricsOverride",{width,height:960,deviceScaleFactor:1,mobile:width<768});
    await page.go(route);await page.wait(`${count(liked.data.id)}==='좋아요 1개'`);
    assert.equal(await page.evaluate(count(zero.data.id)),"좋아요 0개");assert.equal(await page.evaluate(count(pin.data.id)),"좋아요 1개");
    assert(await page.evaluate("Array.from(document.querySelectorAll('.board-row-counts')).every(e=>e.querySelector('[aria-label^=댓글]')&&!e.querySelector('button'))"));
    assert(await page.evaluate("document.documentElement.scrollWidth<=innerWidth"));
    const measure=await page.evaluate(`(()=>{const title=${row(liked.data.id)}.querySelector('.board-row-subject');return{viewport:innerWidth,textLength:title.textContent.length,overflow:getComputedStyle(title).textOverflow,scroll:title.scrollWidth,client:title.clientWidth,rowHeight:${row(liked.data.id)}.getBoundingClientRect().height};})()`);
    measurements.push(measure);await writeFile(path.join(output,"board-list-likes-measurements.json"),JSON.stringify(measurements,null,2));
    const diagnostic=await page.send("Page.captureScreenshot",{format:"png",captureBeyondViewport:true});await writeFile(path.join(output,`board-list-likes-${width}.png`),Buffer.from(diagnostic.data,"base64"));
    assert.equal(measure.overflow,"ellipsis");
    if(width===390)assert(measure.scroll>measure.client,"Long mobile title must be ellipsized");
    await page.evaluate(`${row(liked.data.id)}.scrollIntoView({block:'center',behavior:'instant'})`);
    assert(await page.evaluate(`(()=>{const row=${row(liked.data.id)},r=row.getBoundingClientRect();return document.elementFromPoint(r.right-5,r.bottom-5)?.closest('a')===row.querySelector('.board-row-title');})()`));
    const image=await page.send("Page.captureScreenshot",{format:"png",captureBeyondViewport:true});await writeFile(path.join(output,`board-list-likes-${width}.png`),Buffer.from(image.data,"base64"));
  }
  const like="document.querySelector('.board-post .board-like-button')";
  await page.evaluate(`${row(liked.data.id)}.querySelector('a').click()`);await page.wait(`!!${like}&&!${like}.disabled&&${like}.textContent.includes('좋아요 1')`);
  await page.evaluate(`${like}.click()`);await page.wait(`${like}.getAttribute('aria-pressed')==='true'&&!${like}.disabled&&${like}.textContent.includes('좋아요 2')`);
  await page.evaluate("history.back()");await page.wait(`location.pathname==='/board'&&${count(liked.data.id)}==='좋아요 2개'`);
  await page.evaluate(`${row(liked.data.id)}.querySelector('a').click()`);await page.wait(`!!${like}&&!${like}.disabled&&${like}.textContent.includes('좋아요 2')`);
  await page.evaluate(`${like}.click()`);await page.wait(`${like}.getAttribute('aria-pressed')==='false'&&!${like}.disabled&&${like}.textContent.includes('좋아요 1')`);
  await page.evaluate("Array.from(document.querySelectorAll('a')).find(a=>a.textContent.includes('자유게시판')&&new URL(a.href).pathname==='/board'&&new URL(a.href).searchParams.get('q')==='List Chrome').click()");
  await page.wait(`location.pathname==='/board'&&${count(liked.data.id)}==='좋아요 1개'`);
  assert.equal(await page.evaluate("new URLSearchParams(location.search).get('q')"),"List Chrome");
  await control({extraFailures:{listLikes:1}});await page.go(route);await page.wait(`${count(liked.data.id)}==='좋아요 수 확인 불가'`);
  assert(await page.evaluate(`${row(liked.data.id)}.querySelector('.board-like-count').textContent.includes('—')`));
  await page.send("Page.reload");await page.wait(`${count(liked.data.id)}==='좋아요 1개'`);
  return ["Board read-only list likes show zero/count/unavailable beside comments in posts and pinned notices, ellipsize and preserve row click at 390/768/1440px; confirmed add/cancel updates browser-back/Link returns without polling"];
}
