import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export async function runChoiceLimitBrowser({ page, output, adminPassword }) {
  const checks = [], measurements = [];
  const api = (route, method = "GET", body) => page.evaluate(`fetch(${JSON.stringify(route)},{method:${JSON.stringify(method)},headers:{'Content-Type':'application/json'},${body === undefined ? "" : `body:JSON.stringify(${JSON.stringify(body)}),`}}).then(async r=>({status:r.status,data:await r.json()}))`);
  assert.equal((await api("/api/admin/access", "POST", { password: adminPassword })).status, 200);
  const photo = (await sharp({ create: { width: 240, height: 120, channels: 3, background: "#2453df" } }).png().toBuffer()).toString("base64");
  const photoFile = path.join(output, "choice-limit-create-photo.png"); await writeFile(photoFile, Buffer.from(photo, "base64"));
  for (const width of [320, 390, 430, 768, 1440]) {
    await page.send("Emulation.setDeviceMetricsOverride", { width, height: 960, deviceScaleFactor: 1, mobile: width < 768 });
    await page.go("/admin/polls");
    await page.wait("Array.from(document.querySelectorAll('a[href=\"/admin/polls/new\"]')).some(link=>Object.keys(link).some(key=>key.startsWith('__reactProps')))");
    await page.evaluate("document.querySelector('a[href=\"/admin/polls/new\"]').click()");
    await page.wait("location.pathname==='/admin/polls/new'&&!!document.querySelector('.admin-form > fieldset')&&!document.querySelector('.admin-form > fieldset').disabled");
    assert.equal(await page.evaluate("!!document.querySelector('#poll-max-choices')"), false);
    await page.evaluate("document.querySelectorAll('input[name=vote-mode]')[1].click()");
    await page.wait("!!document.querySelector('#poll-max-choices')");
    assert.deepEqual(await page.evaluate("Array.from(document.querySelector('#poll-max-choices').options).map(option=>option.value)"), ["", "2", "3", "4", "5"]);
    await page.evaluate("(()=>{const select=document.querySelector('#poll-max-choices');select.value='3';select.dispatchEvent(new Event('change',{bubbles:true}));})()");
    await page.wait("document.querySelector('#poll-max-choices').getAttribute('aria-invalid')==='true'&&document.querySelector('.admin-form button[type=submit]').disabled");
    await page.evaluate("Array.from(document.querySelectorAll('.admin-form button')).find(button=>button.textContent.includes('+ 선택지 추가')).click()");
    await page.wait("document.querySelectorAll('.option-editor').length===3");
    await page.evaluate(`(()=>{window.confirm=()=>true;for(const [selector,value] of [['#poll-title',${JSON.stringify(`최대 3개 Chrome ${width}`)}],['#poll-option-0','A'],['#poll-option-1','B'],['#poll-option-2','C']]){const el=document.querySelector(selector);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));}})()`);
    await page.wait("!document.querySelector('.admin-form button[type=submit]').disabled&&document.querySelector('.admin-setting-summary').textContent.includes('최대 3개')");
    // Fourth option enables an actual N+1 attempt after persistence.
    await page.evaluate("Array.from(document.querySelectorAll('.admin-form button')).find(button=>button.textContent.includes('+ 선택지 추가')).click()");
    await page.wait("!!document.querySelector('#poll-option-3')");
    await page.evaluate("(()=>{const el=document.querySelector('#poll-option-3');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'D');el.dispatchEvent(new Event('input',{bubbles:true}));})()");
    if (width === 390) {
      for (const selector of ['[aria-label="질문 이미지"] input[type=file]', '.option-editor:nth-child(1) input[type=file]']) {
        const dom = await page.send("DOM.getDocument"), found = await page.send("DOM.querySelector", { nodeId: dom.root.nodeId, selector });
        assert(found.nodeId); await page.send("DOM.setFileInputFiles", { nodeId: found.nodeId, files: [photoFile] });
      }
      await page.wait("document.querySelectorAll('.poll-draft-preview').length===2");
    }
    await page.evaluate("document.querySelector('.admin-form').requestSubmit()");
    await page.wait("location.pathname.startsWith('/admin/polls/poll-')&&!location.pathname.endsWith('/edit')");
    const slug = await page.evaluate("location.pathname.split('/').pop()");
    const detail = await api(`/api/admin/polls/${slug}`);
    assert.equal(detail.data.poll.max_choices_per_participant, 3); const ids = detail.data.options.map(option => option.id);
    if (width === 390) { assert.equal(detail.data.attachments.images.length, 2, "One-click image creation retains the cap"); assert.equal(detail.data.poll.is_hidden, false); }
    const upload = await page.evaluate(`fetch('/api/admin/polls/${slug}/images',{method:'POST',headers:{'Content-Type':'image/png','Idempotency-Key':crypto.randomUUID(),'X-Option-Id':'${ids[3]}'},body:Uint8Array.from(atob('${photo}'),char=>char.charCodeAt(0))}).then(r=>r.status)`);
    assert.equal(upload, 200);
    await page.go(`/admin/polls/${slug}/edit`); await page.wait("document.querySelector('#poll-max-choices')?.value==='3'");
    assert.equal(await page.evaluate("document.querySelector('#poll-max-choices').disabled"), false);
    assert.equal(await page.evaluate("document.documentElement.scrollWidth>innerWidth"), false, `Admin overflow ${width}`);
    await page.go(`/polls/${slug}`); await page.wait("!!document.querySelector('.poll-options')&&!document.querySelector('.poll-options').disabled");
    await page.wait("document.querySelector('.poll-ballot').textContent.includes('선택한 항목: 0 / 3')");
    for (const index of [0, 1, 2, 3]) await page.evaluate(`document.querySelectorAll('.poll-options input')[${index}].click()`);
    await page.wait("document.querySelector('.poll-ballot [role=status]')?.textContent.includes('기존 선택을 해제')");
    assert.deepEqual(await page.evaluate("Array.from(document.querySelectorAll('.poll-options input:checked')).map(input=>Number(input.value))"), ids.slice(0, 3));
    assert(await page.evaluate("Array.from(document.querySelectorAll('.poll-options input')).every(input=>!input.disabled)"));
    // Uncheck one, then select another via keyboard rather than click.
    await page.evaluate("document.querySelectorAll('.poll-options input')[1].click();document.querySelectorAll('.poll-options input')[3].focus()");
    await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32, text: " " });
    await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
    await page.wait("document.querySelectorAll('.poll-options input:checked').length===3");
    const chosen = await page.evaluate("Array.from(document.querySelectorAll('.poll-options input:checked')).map(input=>Number(input.value))");
    assert.deepEqual(chosen, [ids[0], ids[2], ids[3]]);
    await page.evaluate("document.querySelector('.poll-option-with-image .poll-image-open').click()"); await page.wait("!!document.querySelector('.poll-image-dialog[open]')");
    assert.deepEqual(await page.evaluate("Array.from(document.querySelectorAll('.poll-options input:checked')).map(input=>Number(input.value))"), chosen);
    await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await page.wait("!document.querySelector('.poll-image-dialog[open]')");
    assert.equal(await page.evaluate("document.activeElement.className"), "poll-image-open");
    assert.equal(await page.evaluate("document.documentElement.scrollWidth>innerWidth"), false, `Ballot overflow ${width}`);
    const screenshot = await page.send("Page.captureScreenshot", { format: "png" }); await writeFile(path.join(output, `choice-limit-${width}.png`), Buffer.from(screenshot.data, "base64"));
    await page.evaluate("(()=>{const form=document.querySelector('.poll-ballot form');form.requestSubmit();form.requestSubmit();})()");
    await page.wait("document.querySelector('.poll-ballot [data-tone=success]')?.textContent.includes('투표')");
    assert.equal(await page.evaluate("document.querySelectorAll('.poll-ballot section[aria-label=\"내 선택\"] li').length"), 3);
    const actual = await api(`/api/polls/${slug}/participation`); assert.deepEqual(actual.data.option_ids, chosen);
    await page.go(`/admin/polls/${slug}/edit`); await page.wait("!!document.querySelector('#poll-max-choices')&&document.querySelector('#poll-max-choices').disabled");
    assert(await page.evaluate("document.querySelector('#poll-max-choices-note').textContent.includes('이미 참여 기록')"));
    measurements.push({ width, adminPersisted: 3, overflow: false, nPlusOneRejected: true, removable: true, keyboardSelection: true, imageExpansionIndependent: true, dialogFocusRestored: true, confirmedSavedCount: 3, settingLocked: true });
  }
  checks.push("320/390/430/768/1440: admin setting/show/hide/option-count validation/summary/persistence, N+1 rejected preserving previous choices, removal+keyboard replacement, count, no overflow, image dialog/ESC/focus without changing choices, confirmed save and history lock");
  await writeFile(path.join(output, "choice-limit-measurements.json"), JSON.stringify(measurements, null, 2));
  return checks;
}
