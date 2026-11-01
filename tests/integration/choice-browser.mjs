import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export async function runChoiceBrowserChecks({ page, base, output, adminPassword }) {
  const control = async value => (await fetch("http://127.0.0.1:3102/_test", { method: "POST", body: JSON.stringify(value) })).json();
  const choose = async ids => {
    for (const id of ids) await page.evaluate(`document.querySelector('.poll-ballot input[value="${id}"]').click()`);
  };
  const ready = async slug => {
    await page.go(`/polls/${slug}`);
    await page.wait("!!document.querySelector('.poll-ballot fieldset')&&!document.querySelector('.poll-ballot fieldset').disabled");
  };
  const submit = async () => page.evaluate("document.querySelector('.poll-ballot button[type=submit]').click()");
  const saved = async () => page.wait("document.querySelector('.poll-ballot [data-tone=success]')?.textContent.length>0");

  await control({ voteFailure: null });
  await ready("ui-multi");
  assert.equal(await page.evaluate("document.querySelectorAll('.poll-ballot input[type=checkbox]').length"), 3);
  assert.equal(await page.evaluate("document.querySelector('.poll-ballot button[type=submit]').disabled"), true);
  await choose([1401, 1402, 1403]);
  await page.wait("document.querySelector('.poll-ballot button[type=submit]').textContent.includes('3개 선택')");
  await submit(); await saved();
  assert(await page.evaluate("document.querySelector('.poll-ballot [data-tone=success]').textContent.includes('각각 1표')"));
  assert.equal(await page.evaluate("document.querySelectorAll('.poll-ballot section[aria-label=\"내 선택\"] li').length"), 3);
  await page.wait("document.querySelector('.poll-results')?.textContent.includes('총 선택 3개')");
  assert(await page.evaluate("document.documentElement.scrollWidth<=innerWidth"));
  await page.evaluate("document.querySelector('.poll-ballot .vote-feedback').scrollIntoView({block:'center'})");
  const capture = await page.send("Page.captureScreenshot", { format: "png" });
  await writeFile(path.join(output, "poll-multiple-390.png"), Buffer.from(capture.data, "base64"));
  // Closing during a result refresh must not discard confirmed completion feedback.
  await control({ changePoll: { slug: "ui-multi", is_closed: true } });
  await page.evaluate("Array.from(document.querySelectorAll('.poll-interaction > button')).find(b=>b.textContent==='투표 정보 새로고침').click()");
  await page.wait("document.querySelector('.poll-interaction').textContent.includes('관리자가 투표를 종료했습니다.')");
  assert.equal(await page.evaluate("!!document.querySelector('.poll-ballot button[type=submit]')"), false);
  assert(await page.evaluate("!!document.querySelector('.poll-ballot [data-tone=success]')"));
  await control({ changePoll: { slug: "ui-multi", is_closed: false } });
  await page.wait("!!Array.from(document.querySelectorAll('.poll-interaction > button')).find(b=>b.textContent==='투표 정보 새로고침'&&!b.disabled)");
  await page.evaluate("Array.from(document.querySelectorAll('.poll-interaction > button')).find(b=>b.textContent==='투표 정보 새로고침').click()");
  await page.wait("!!Array.from(document.querySelectorAll('.poll-ballot button')).find(b=>b.textContent==='선택 변경하기'&&!b.disabled)");
  await page.evaluate("Array.from(document.querySelectorAll('.poll-ballot button')).find(b=>b.textContent==='선택 변경하기').click()");
  await page.wait("!!document.querySelector('.poll-ballot input[type=checkbox]')");
  await choose([1402]); await submit(); await saved();
  assert.equal(await page.evaluate("document.querySelectorAll('.poll-ballot section[aria-label=\"내 선택\"] li').length"), 2);
  let state = await control({});
  assert.equal(state.choiceSelections.filter(v=>v.poll_id===14&&v.is_selected).length, 2);
  assert.equal(state.choiceSelections.find(v=>v.poll_id===14&&v.option_id===1402).is_selected, false);

  await ready("ui-double"); await choose([1701, 1702]); await control({ voteFailure: null });
  // Synchronous duplicate events arrive before React has necessarily rendered disabled.
  await page.evaluate("(()=>{const form=document.querySelector('.poll-ballot form');form.requestSubmit();form.requestSubmit();})()");
  await saved(); state = await control({});
  assert.equal(state.voteRequestCount, 1);
  assert.equal(state.choiceSelections.filter(v=>v.poll_id===17&&v.is_selected).length, 2);
  assert.equal(await page.evaluate("!!Array.from(document.querySelectorAll('.poll-ballot button')).find(b=>b.textContent==='선택 변경하기')"), false);

  await ready("ui-uncertain"); await choose([1501, 1503]); await control({ voteFailure: "after" });
  try {
    await submit(); await saved();
    assert(await page.evaluate("document.querySelector('.poll-ballot [data-tone=success]').textContent.includes('저장된 선택을 확인')"));
    state = await control({}); assert.equal(state.voteRequestCount, 1);
    assert.equal(state.choiceSelections.filter(v=>v.poll_id===15&&v.is_selected).length, 2);
  } finally { await control({ voteFailure: null }); }

  await ready("ui-failure"); await choose([1601]); await control({ voteFailure: "before" });
  try {
    await submit();
    await page.wait("document.querySelector('.poll-ballot [data-tone=uncertain]')?.textContent.includes('등록 여부를 아직 확인')");
    assert.equal(await page.evaluate("!!document.querySelector('.poll-ballot [data-tone=success]')"), false);
    assert.equal(await page.evaluate("!!document.querySelector('.poll-ballot button[type=submit]')"), false);
    await page.wait("!!Array.from(document.querySelectorAll('.poll-ballot button')).find(b=>b.textContent==='참여 상태 확인'&&!b.disabled)");
    await page.evaluate("Array.from(document.querySelectorAll('.poll-ballot button')).find(b=>b.textContent==='참여 상태 확인').click()");
    await page.wait("!!Array.from(document.querySelectorAll('.poll-ballot button')).find(b=>b.textContent==='참여 상태 확인'&&!b.disabled)");
    state = await control({}); assert.equal(state.voteRequestCount, 1);
    assert.equal(state.choiceSelections.filter(v=>v.poll_id===16).length, 0);
  } finally { await control({ voteFailure: null }); }

  await page.go("/polls/changeable");
  await page.wait("!!Array.from(document.querySelectorAll('.poll-ballot button')).find(b=>b.textContent==='선택 변경하기')");
  await page.evaluate("Array.from(document.querySelectorAll('.poll-ballot button')).find(b=>b.textContent==='선택 변경하기').click()");
  assert.equal(await page.evaluate("document.querySelectorAll('.poll-ballot input[type=radio]').length"), 2);
  await choose([201]); await submit(); await saved();

  await page.go("/polls/text-private");
  await page.wait("!!Array.from(document.querySelectorAll('.text-ballot button')).find(b=>b.textContent==='응답 수정')");
  await page.evaluate("Array.from(document.querySelectorAll('.text-ballot button')).find(b=>b.textContent==='응답 수정').click()");
  await page.evaluate("(()=>{const el=document.querySelector('.text-ballot textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,'브라우저 합성 주관식 응답');el.dispatchEvent(new Event('input',{bubbles:true}));})()");
  await page.wait("!document.querySelector('.text-ballot button[type=submit]').disabled");
  await page.evaluate("document.querySelector('.text-ballot button[type=submit]').click()");
  await page.wait("!!document.querySelector('.text-ballot [data-tone=success]')");

  // Administrator authorization still requires a distinct password and session.
  const status = await page.evaluate(`fetch(${JSON.stringify(base + "/api/admin/access")},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:${JSON.stringify(adminPassword)}})}).then(r=>r.status)`);
  assert.equal(status, 200);
  await page.go("/admin/polls/new"); await page.wait("!!document.querySelector('.admin-form > fieldset')&&!document.querySelector('.admin-form > fieldset').disabled");
  await page.evaluate("document.querySelectorAll('input[name=vote-mode]')[1].click()");
  assert(await page.evaluate("document.querySelector('.admin-form').textContent.includes('복수선택 허용')"));
  await page.evaluate("Array.from(document.querySelectorAll('.admin-form .check-label')).find(l=>l.textContent.includes('선택 변경 허용')).querySelector('input').click()");
  await page.evaluate("(()=>{for(const [selector,value] of [['#poll-title','Browser multiple fixture'],['#poll-option-0','A'],['#poll-option-1','B']]){const el=document.querySelector(selector);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));}})()");
  await page.evaluate("document.querySelector('.admin-form button[type=submit]').click()");
  await page.wait("location.pathname.startsWith('/admin/polls/poll-')&&!location.pathname.endsWith('/edit')");
  state = await control({});
  const created = state.polls.find(p=>p.title==="Browser multiple fixture");
  assert.equal(created.vote_mode, "multiple"); assert.equal(created.allow_vote_change, true);
  assert(await page.evaluate("document.documentElement.scrollWidth<=innerWidth"));
  await page.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 960, deviceScaleFactor: 1, mobile: false });
  await page.go("/polls/ui-multi");
  await page.wait("document.querySelectorAll('.poll-ballot section[aria-label=\"내 선택\"] li').length===2");
  assert(await page.evaluate("document.documentElement.scrollWidth<=innerWidth"));
  const desktop = await page.send("Page.captureScreenshot", { format: "png" });
  await writeFile(path.join(output, "poll-multiple-1440.png"), Buffer.from(desktop.data, "base64"));
  await page.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  return ["Checkbox batch/count/completion/change", "Radio single choice", "Synchronous double-submit blocked", "Committed lost response reconciled without another POST", "Rejected write shows no success and locks uncertain resubmission", "Text response preserved", "Admin multiple/change settings saved through GUI"];
}
