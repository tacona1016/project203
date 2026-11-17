import assert from "node:assert/strict";
import {writeFile} from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
export async function runPollImageBrowser({page,output,adminPassword,slug,optionIds}) {
  const checks=[],measurements=[];
  const api=(route,method='GET',body)=>page.evaluate(`fetch(${JSON.stringify(route)},{method:${JSON.stringify(method)},headers:{'Content-Type':'application/json'},${body===undefined?'':`body:JSON.stringify(${JSON.stringify(body)}),`}}).then(async r=>({status:r.status,data:await r.json()}))`);
  assert.equal((await api('/api/admin/access','POST',{password:adminPassword})).status,200);
  const existing=await api(`/api/admin/polls/${slug}/images`),questionCount=existing.data.images.filter(i=>i.option_id===null).length;assert.equal(questionCount,3);
  for(const width of [320,390,430,768,1440]){
    await page.send('Emulation.setDeviceMetricsOverride',{width,height:960,deviceScaleFactor:1,mobile:width<768});
    await page.go(`/polls/${slug}`);await page.wait("!!document.querySelector('.poll-image-open')&&!!document.querySelector('.poll-options input:not(:disabled)')");
    assert.equal(await page.evaluate('document.documentElement.scrollWidth>innerWidth'),false,`No overflow at ${width}`);
    const before=await page.evaluate("Array.from(document.querySelectorAll('.poll-options input:checked')).length");
    await page.evaluate("document.querySelector('.poll-option-with-image .poll-image-open').click()");await page.wait("!!document.querySelector('.poll-image-dialog[open]')");
    assert.equal(await page.evaluate("Array.from(document.querySelectorAll('.poll-options input:checked')).length"),before,'Expand must not choose an option');
    assert.equal(await page.evaluate("document.body.style.overflow"),'hidden');
    await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await page.wait("!document.querySelector('.poll-image-dialog[open]')");assert.equal(await page.evaluate("document.activeElement.className"),'poll-image-open');
    const capture=await page.send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(output,`poll-images-${width}.png`),Buffer.from(capture.data,'base64'));
    measurements.push({width,overflow:false,expandWithoutSelection:true,focusRestored:true});
    await page.go(`/admin/polls/${slug}/edit`);await page.wait("!!document.querySelector('section[aria-label=\"투표 이미지 관리\"] input[type=file]')");
    assert.equal(await page.evaluate('document.documentElement.scrollWidth>innerWidth'),false,`Admin overflow at ${width}`);
  }
  checks.push('Question/option gallery, independent checkbox/expand, native dialog Escape/focus/scroll at 320/390/430/768/1440');
  // Choose a real local PNG through the browser file input; application fetch,
  // codec and synthetic Storage are used, without intercepting successful ACKs.
  const filePath=path.join(output,'poll-upload-fixture.png');await sharp({create:{width:200,height:100,channels:3,background:'#669966'}}).png().toFile(filePath);
  const image=existing.data.images.find(i=>i.option_id!==null&&String(i.option_id)===String(optionIds[2]));
  assert.equal((await api(`/api/admin/polls/${slug}/images/${image.id}`,'DELETE')).status,200);
  await page.go(`/admin/polls/${slug}/edit`);await page.wait("!!document.querySelector('.poll-image-option-admin input[type=file]:not(:disabled)')");
  const dom=await page.send('DOM.getDocument'),found=await page.send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:`.poll-image-option-admin[data-option-id="${optionIds[2]}"] input[type=file]:not(:disabled)`});assert(found.nodeId);
  await page.send('DOM.setFileInputFiles',{nodeId:found.nodeId,files:[filePath]});
  await page.wait("document.querySelector('[aria-label=\"투표 이미지 관리\"] [role=status]')?.textContent.includes('업로드 완료')");
  const ready=await api(`/api/admin/polls/${slug}/images`);assert(ready.data.images.some(i=>String(i.option_id)===String(optionIds[2])));
  assert(await page.evaluate("document.querySelector('[aria-label=\"투표 이미지 관리\"]').textContent.includes('KB')"));
  checks.push('Real Chrome file selection, upload/preview/final byte feedback through real Next API + synthetic Storage');
  // Reveal only by using the existing admin close policy; images follow sorted
  // result option IDs and do not alter any counts.
  await api(`/api/admin/polls/${slug}/state`,'POST',{action:'close'});
  await page.go(`/polls/${slug}`);await page.wait("!!document.querySelector('.poll-results .poll-image-open')");
  await page.evaluate("(()=>{const el=document.querySelector('.result-sort select');el.value='votes';el.dispatchEvent(new Event('change',{bubbles:true}));})()");
  assert(await page.evaluate("Array.from(document.querySelectorAll('.poll-results li')).some(li=>li.textContent.includes('B')&&li.querySelector('img'))"));
  checks.push('Results image remains tied to option ID after vote sorting and existing close/publication policy');
  await fetch('http://127.0.0.1:3102/_test',{method:'POST',body:JSON.stringify({pollImagesMissing:true})});
  await page.go(`/admin/polls/${slug}/edit`);await page.wait("document.querySelector('[aria-label=\"투표 이미지 관리\"]')?.textContent.includes('DB·비공개 저장소')");
  assert(await page.evaluate("Array.from(document.querySelectorAll('[aria-label=\"투표 이미지 관리\"] input[type=file]')).every(el=>el.disabled)"));
  await fetch('http://127.0.0.1:3102/_test',{method:'POST',body:JSON.stringify({pollImagesMissing:false})});
  checks.push('Missing image schema disables image editing while existing poll form renders');
  await writeFile(path.join(output,'poll-images-measurements.json'),JSON.stringify(measurements,null,2));return checks;
}
