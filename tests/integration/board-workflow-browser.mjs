import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export async function runBoardWorkflowBrowser({ page, base, output, id }) {
  assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Board workflows must use local fixtures");
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const setField = async (selector, value) => page.evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Missing workflow field');Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const api = async (route, method = "GET", body) => page.evaluate(`fetch(${JSON.stringify(route)},{method:${JSON.stringify(method)},cache:'no-store',${body === undefined ? "" : `headers:{'Content-Type':'application/json'},body:JSON.stringify(${JSON.stringify(body)}),`}}).then(async r=>({status:r.status,data:await r.json()}))`);
  const go = async route => {
    await page.go(route);
    await page.wait(`location.pathname===${JSON.stringify(new URL(route, base).pathname)}&&!!document.querySelector('header .name-current')`);
    if (route.startsWith("/board/new")) await page.wait("!!document.querySelector('.board-editor > fieldset')&&!document.querySelector('.board-editor > fieldset').disabled&&!!document.querySelector('.board-draft-tools input')&&!document.querySelector('.board-draft-tools input').disabled");
    if (route.startsWith("/admin/polls/new")) await page.wait("!!document.querySelector('.admin-form > fieldset')&&!document.querySelector('.admin-form > fieldset').disabled");
  };
  const screenshot = async name => {
    const result = await page.send("Page.captureScreenshot", { format: "png" });
    await writeFile(path.join(output, name), Buffer.from(result.data, "base64"));
  };
  const noOverflow = async () => assert(await page.evaluate("document.documentElement.scrollWidth<=innerWidth"));
  await page.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });

  // A distinct synthetic story makes edit/cancel assertions independent of old
  // fixtures. Requests go through the real protected Next.js API and sessions.
  const created = await api("/api/board/posts", "POST", { title: "댓글 수정용 합성 이야기", content: "로컬 테스트에서만 사용하는 본문입니다.", post_type: "general", is_pinned: false });
  assert.equal(created.status, 200);
  const postId = created.data.id;
  const originalComment = "처음 작성한 합성 댓글";
  const commented = await api(`/api/board/posts/${postId}/comments`, "POST", { content: originalComment });
  assert.equal(commented.status, 200);
  const commentId = commented.data.id;
  await go(`/board/${postId}`);
  await page.wait("Array.from(document.querySelectorAll('.board-comments li')).find(li=>li.textContent.includes('처음 작성한 합성 댓글'))?.querySelector('button')?.textContent==='수정'");
  const editButton = "Array.from(document.querySelectorAll('.board-comments li')).find(li=>li.textContent.includes('처음 작성한 합성 댓글')).querySelector('button')";
  assert.equal(await page.evaluate(`${editButton}.textContent`), "수정");
  await page.evaluate(`${editButton}.click()`);
  await page.wait("!!document.querySelector('.board-comment-edit textarea')");
  await setField(".board-comment-edit textarea", "취소할 합성 변경");
  await page.evaluate("Array.from(document.querySelectorAll('.board-comment-edit button')).find(b=>b.textContent==='수정 취소').click()");
  await page.wait("!document.querySelector('.board-comment-edit textarea')");
  let comments = await api(`/api/board/posts/${postId}/comments`);
  assert.equal(comments.data.find(comment => String(comment.id) === String(commentId)).content, originalComment);
  await page.evaluate(`${editButton}.click()`);
  await page.wait("!!document.querySelector('.board-comment-edit textarea')");
  const revisedComment = "저장한 합성 댓글 https://example.org/review";
  await setField(".board-comment-edit textarea", revisedComment);
  await page.wait("!document.querySelector('.board-comment-edit button[type=submit]').disabled");
  await page.evaluate("document.querySelector('.board-comment-edit').requestSubmit()");
  await page.wait("document.querySelector('.board-comments [role=status]')?.textContent.includes('댓글 수정이 저장되었습니다.')");
  comments = await api(`/api/board/posts/${postId}/comments`);
  const revised = comments.data.find(comment => String(comment.id) === String(commentId));
  assert.equal(revised.content, revisedComment);
  assert.equal(revised.author_id, id(1));
  assert(await page.evaluate(`!!Array.from(document.querySelectorAll('.board-comments time')).find(time=>time.getAttribute('datetime')===${JSON.stringify(revised.updated_at)})`));
  await page.evaluate("document.querySelector('.board-comments').scrollIntoView({block:'start'})");
  await screenshot("workflow-comment-edit-390.png"); await noOverflow();

  const draftKey = `project203_board_draft:v1:${id(1)}:new:general`;
  const otherDraftKey = `project203_board_draft:v1:${id(1)}:new:notice`;
  await page.evaluate(`localStorage.setItem(${JSON.stringify(otherDraftKey)},'separate-notice-draft-fixture')`);
  await page.evaluate(`localStorage.removeItem(${JSON.stringify(draftKey)})`);
  await go("/board/new");
  const draftTitle = "기기 초안 복원 합성 이야기";
  const draftBody = "복원할 합성 본문 😀\nhttps://example.com/path\njavascript:alert(1)\n<script>window.workflowUnsafe=true</script>";
  await setField("#board-title", draftTitle); await setField("#board-content", draftBody);
  await page.wait(`document.querySelector('#board-content').value===${JSON.stringify(draftBody)}`);
  assert.equal(await page.evaluate(`localStorage.getItem(${JSON.stringify(draftKey)})`), null, "draft persistence starts only after opt-in");
  await page.evaluate("document.querySelector('.board-draft-tools input[type=checkbox]').click()");
  await page.wait(`JSON.parse(localStorage.getItem(${JSON.stringify(draftKey)})||'null')?.content===${JSON.stringify(draftBody)}`);
  await page.send("Page.reload");
  await page.wait("!!document.querySelector('.board-editor > fieldset')&&!document.querySelector('.board-editor > fieldset').disabled&&!!Array.from(document.querySelectorAll('.board-draft-tools button')).find(b=>b.textContent==='임시작성 불러오기')");
  assert.equal(await page.evaluate("document.querySelector('#board-content').value"), "", "a stored draft never overwrites a new form automatically");
  assert.equal(await page.evaluate("document.querySelector('.board-draft-tools input[type=checkbox]').checked"), false);
  await page.evaluate("Array.from(document.querySelectorAll('.board-draft-tools button')).find(b=>b.textContent==='임시작성 불러오기').click()");
  await page.wait(`document.querySelector('#board-title').value===${JSON.stringify(draftTitle)}&&document.querySelector('#board-content').value===${JSON.stringify(draftBody)}&&document.querySelector('.board-draft-tools input[type=checkbox]').checked`);
  await screenshot("workflow-draft-restored-390.png");
  await page.evaluate("window.confirm=()=>false;Array.from(document.querySelectorAll('.board-editor a')).find(a=>a.textContent==='취소').click()");
  await pause(100);
  assert.equal(await page.evaluate("location.pathname"), "/board/new");
  assert.equal(await page.evaluate("document.querySelector('#board-content').value"), draftBody);
  await page.evaluate("document.querySelector('.board-editor').requestSubmit()");
  await page.wait(`new RegExp("^/board/[0-9]+$").test(location.pathname)&&document.querySelector('h1')?.textContent===${JSON.stringify(draftTitle)}`);
  assert.equal(await page.evaluate(`localStorage.getItem(${JSON.stringify(draftKey)})`), null, "acknowledged creation clears the matching local draft");
  assert.equal(await page.evaluate(`localStorage.getItem(${JSON.stringify(otherDraftKey)})`), "separate-notice-draft-fixture", "saving a general story preserves an independent notice draft");
  assert(await page.evaluate("document.body.textContent.includes('게시글이 저장되었습니다.')"));
  assert.equal(await page.evaluate("document.querySelector('.board-post-content a')?.href"), "https://example.com/path");
  assert.equal(await page.evaluate("!!document.querySelector('.board-post-content script')||!!document.querySelector('.board-post-content a[href^=javascript]')||window.workflowUnsafe===true"), false);
  assert(await page.evaluate("document.querySelector('.board-post-content').textContent.includes('javascript:alert(1)')"));

  // The synthetic baseline has thirteen matching stories, so page two exists.
  const searchPath = `/board?${new URLSearchParams({ q: "기존", page: "2" })}`;
  await go(searchPath);
  await page.wait("!!document.querySelector('.board-post-list .board-row-title')");
  const firstHref = await page.evaluate("document.querySelector('.board-post-list .board-row-title').getAttribute('href')");
  assert.equal(new URL(firstHref, base).searchParams.get("returnTo"), searchPath);
  await page.evaluate("document.querySelector('.board-post-list .board-row-title').click()");
  await page.wait("new RegExp('^/board/[0-9]+$').test(location.pathname)&&!!document.querySelector('.board-post')");
  const backHref = await page.evaluate("Array.from(document.querySelectorAll('main a')).find(a=>a.textContent==='← 자유게시판').getAttribute('href')");
  assert.equal(backHref, searchPath);
  await page.evaluate("Array.from(document.querySelectorAll('main a')).find(a=>a.textContent==='← 자유게시판').click()");
  await page.wait("location.pathname==='/board'&&new URLSearchParams(location.search).get('q')==='기존'&&new URLSearchParams(location.search).get('page')==='2'");
  await go("/board");
  await page.wait("!!document.querySelector('.board-new-badge')");
  assert(await page.evaluate("document.querySelector('.board-new-badge').getAttribute('title').includes('읽지 않음 표시가 아닙니다')"));

  await go("/admin");
  await page.wait("document.querySelectorAll('.admin-dashboard-stats > div').length===6");
  for (const label of ["전체 투표", "진행 중", "예정", "종료", "숨김", "7일 내 마감"]) assert(await page.evaluate(`document.querySelector('.admin-dashboard-stats').textContent.includes(${JSON.stringify(label)})`));
  for (const route of ["/board/new?type=notice", "/board#board-notices", "/board"]) assert(await page.evaluate(`!!document.querySelector('main a[href=${JSON.stringify(route)}]')`));
  await go("/admin/polls?quarter=all");
  const targetSlug = (await api("/api/admin/polls")).data.find(item => item.status === "ACTIVE" && !item.poll.is_hidden)?.poll.slug;
  assert(targetSlug, "an active synthetic poll is available for confirmation checks");
  const targetRow = `Array.from(document.querySelectorAll('.poll-card')).find(row=>row.querySelector('a[href=${JSON.stringify(`/admin/polls/${targetSlug}`)}]'))`;
  await page.wait(`!!${targetRow}`);
  const before = (await api("/api/admin/polls")).data.find(item => item.poll.slug === targetSlug).poll.is_closed;
  await page.evaluate(`window.workflowConfirm=window.confirm;window.confirm=()=>false;Array.from(${targetRow}.querySelectorAll('button')).find(b=>b.textContent==='종료').click()`);
  await pause(100);
  assert.equal((await api("/api/admin/polls")).data.find(item => item.poll.slug === targetSlug).poll.is_closed, before);
  try {
    await page.evaluate(`window.confirm=()=>true;Array.from(${targetRow}.querySelectorAll('button')).find(b=>b.textContent==='종료').click()`);
    await page.wait(`fetch('/api/admin/polls',{cache:'no-store'}).then(r=>r.json()).then(items=>items.find(i=>i.poll.slug===${JSON.stringify(targetSlug)})?.poll.is_closed===true)`);
    await page.wait(`!!${targetRow}&&!!Array.from(${targetRow}.querySelectorAll('button')).find(b=>b.textContent==='재개'&&!b.disabled)`);
    await page.evaluate(`Array.from(${targetRow}.querySelectorAll('button')).find(b=>b.textContent==='재개').click()`);
    await page.wait(`fetch('/api/admin/polls',{cache:'no-store'}).then(r=>r.json()).then(items=>items.find(i=>i.poll.slug===${JSON.stringify(targetSlug)})?.poll.is_closed===false)`);
  } finally { await page.evaluate("if(window.workflowConfirm){window.confirm=window.workflowConfirm;delete window.workflowConfirm}"); }

  const pollsBeforeInvalid = (await api("/api/admin/polls")).data.length;
  await go("/admin/polls/new");
  await page.evaluate("document.querySelector('.admin-form').requestSubmit()");
  await page.wait("document.querySelector('#poll-title')?.getAttribute('aria-invalid')==='true'&&!!document.querySelector('#poll-title-error')");
  await page.wait("document.activeElement===document.querySelector('#poll-title')");
  await setField("#poll-title", "저장하지 않을 합성 설정");
  await setField("#poll-option-0", "첫 선택지"); await setField("#poll-option-1", "둘째 선택지");
  await page.evaluate("document.querySelectorAll('input[name=period]')[1].click()");
  await page.wait("!!document.querySelector('#poll-start')");
  await setField("#poll-start", "2027-01-02T09:00"); await setField("#poll-end", "2027-01-01T09:00");
  await page.evaluate("document.querySelector('.admin-form').requestSubmit()");
  await page.wait("!!document.querySelector('#poll-period-error')&&document.querySelector('#poll-end').getAttribute('aria-invalid')==='true'");
  assert.equal((await api("/api/admin/polls")).data.length, pollsBeforeInvalid);
  await noOverflow(); await screenshot("workflow-admin-field-errors-390.png");

  return [
    "Board own comment edits cancel without writes, save through protected API, and show edited time/feedback",
    "Device drafts require opt-in, restore only on request after reload, preserve cancel input, and clear after acknowledged creation",
    "Board search/page survives detail navigation; NEW means recent, and text URLs are safe links without HTML execution",
    "Administrator overview has six counts and notice shortcuts; canceled close does not mutate and accepted close/reopen work",
    "Administrator title/period errors stay beside fields and invalid forms create no poll",
  ];
}
