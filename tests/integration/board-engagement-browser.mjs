import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export async function runBoardEngagementBrowser({ page, base, output }) {
  assert.equal(new URL(base).hostname,"127.0.0.1");
  const control=body=>fetch('http://127.0.0.1:3103/_test',{method:'POST',body:JSON.stringify(body)});
  const stats=()=>fetch('http://127.0.0.1:3103/_test').then(r=>r.json());
  const field=async(selector,value)=>page.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const uploadFile=path.join(output,'board-upload.png');await writeFile(uploadFile,await sharp({create:{width:600,height:400,channels:3,background:'#a1b4c5'}}).png().toBuffer());
  async function choose(){await page.send('DOM.enable');const doc=await page.send('DOM.getDocument');const node=await page.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'.board-image-picker input[type=file]'});assert(node.nodeId);await page.send('DOM.setFileInputFiles',{nodeId:node.nodeId,files:[uploadFile]});await page.wait("document.querySelectorAll('.board-photo-previews img[src^=blob]').length===1");}
  await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:true});
  await page.go('/board/new');await page.wait("!!document.querySelector('.board-draft-tools input')&&!document.querySelector('.board-draft-tools input').disabled");
  const title='사진 재시도 브라우저 합성 글';await field('#board-title',title);await field('#board-content','사진 실패에도 본문을 보존합니다.');await choose();
  assert.equal(await page.evaluate("Object.values(localStorage).some(value=>value.includes('data:image/')||value.includes('blob:'))"),false);
  await control({extraFailures:{upload:1}});await page.evaluate("document.querySelector('.board-editor').requestSubmit()");
  await page.wait("document.querySelector('.board-editor .form-error')?.textContent.includes('본문은 저장')");
  assert.equal((await stats()).posts.filter(p=>p.title===title).length,1);
  await page.evaluate("document.querySelector('.board-editor').requestSubmit()");
  await page.wait(`new RegExp('^/board/[0-9]+$').test(location.pathname)&&document.querySelector('h1')?.textContent===${JSON.stringify(title)}`);
  const postId=await page.evaluate("location.pathname.split('/').at(-1)");
  assert.equal((await stats()).posts.filter(p=>p.title===title).length,1);
  await page.wait("document.querySelectorAll('.board-gallery-grid img').length===1&&document.querySelector('.board-gallery-grid img').complete");
  const original=(await stats()).images.find(i=>String(i.post_id)===postId&&i.state==='ready').id;
  const like="document.querySelector('.board-post-footer .board-like-button')";
  await page.wait(`!!${like}&&!${like}.disabled`);
  await page.evaluate(`${like}.click();${like}.click()`);await page.wait(`${like}.getAttribute('aria-pressed')==='true'&&!${like}.disabled`);
  assert(await page.evaluate(`${like}.textContent.includes('좋아요 1')`));
  await page.evaluate(`${like}.click()`);await page.wait(`${like}.getAttribute('aria-pressed')==='false'&&!${like}.disabled`);
  await control({extraFailures:{likeLostAck:1}});await page.evaluate(`${like}.click()`);await page.wait(`${like}.getAttribute('aria-pressed')==='true'&&!${like}.disabled`);
  await page.send('Page.reload');await page.wait(`!!${like}&&!${like}.disabled&&${like}.getAttribute('aria-pressed')==='true'`);
  await page.evaluate("document.querySelector('.board-gallery-grid button').click()");await page.wait("document.querySelector('.board-image-dialog').open");
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await page.wait("!document.querySelector('.board-image-dialog').open");
  await field('#board-comment','수정해도 좋아요를 유지할 댓글');await page.evaluate("document.querySelector('.board-comments > form').requestSubmit()");
  await page.wait("document.querySelector('.board-comments li .board-like-button')?.textContent.includes('좋아요 0')");
  await page.evaluate("document.querySelector('.board-comments li .board-like-button').click()");await page.wait("document.querySelector('.board-comments li .board-like-button').getAttribute('aria-pressed')==='true'");
  await page.evaluate("Array.from(document.querySelectorAll('.board-comments li button')).find(b=>b.textContent==='수정').click()");
  await field('.board-comment-edit textarea','수정된 댓글');await page.evaluate("document.querySelector('.board-comment-edit').requestSubmit()");
  await page.wait("document.querySelector('.board-comments [role=status]')?.textContent.includes('수정이 저장')");
  assert.equal(await page.evaluate("document.querySelector('.board-comments li .board-like-button').getAttribute('aria-pressed')"),'true');
  await page.go(`/board/${postId}/edit`);await page.wait("document.querySelector('.board-editor > fieldset')?.disabled===false&&document.querySelectorAll('.board-photo-previews img').length===1");
  await field('#board-content','사진 교체 후에도 댓글과 좋아요를 보존합니다.');
  await page.evaluate("Array.from(document.querySelectorAll('.board-photo-previews button')).find(b=>b.textContent==='사진 삭제').click()");
  assert(await page.evaluate("document.querySelector('.board-photo-previews').textContent.includes('삭제 예정')"));
  await page.evaluate("Array.from(document.querySelectorAll('.board-photo-previews button')).find(b=>b.textContent==='삭제 취소').click()");
  assert.equal((await stats()).images.find(i=>i.id===original).state,'ready');
  await page.evaluate("Array.from(document.querySelectorAll('.board-photo-previews button')).find(b=>b.textContent==='사진 삭제').click()");await choose();
  await page.evaluate("document.querySelector('.board-editor').requestSubmit()");await page.wait(`location.pathname==='/board/${postId}'&&document.querySelectorAll('.board-gallery-grid img').length===1`);
  assert.equal((await stats()).images.some(i=>i.id===original),false);
  await page.wait(`${like}.textContent.includes('좋아요 1')`);
  assert.equal(await page.evaluate("document.querySelector('.board-comments li .board-like-button').getAttribute('aria-pressed')"),'true');
  for(const width of [390,768,1440]){
    await page.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
    await page.evaluate("document.querySelector('.board-gallery').scrollIntoView({block:'center'})");
    await page.wait("document.querySelector('.board-gallery-grid img').complete");
    assert(await page.evaluate("document.documentElement.scrollWidth<=innerWidth"));
    const screenshot=await page.send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(output,`board-likes-images-${width}.png`),Buffer.from(screenshot.data,'base64'));
  }
  return ['BOARD photo picker/preview/retry saves one post, strips file state from drafts, replaces photos and preserves comments/likes', 'BOARD optimistic likes, double-click lock, lost-ACK reconciliation, reload persistence and own comment edits work in Chrome', 'BOARD authenticated gallery opens/closes with Escape and has no overflow at 390/768/1440px'];
}
