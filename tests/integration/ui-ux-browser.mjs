import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";

// Runs only against the existing local synthetic server. These checks never
// create a valid Board post/comment, change a real account, or contact production.
export async function runUiUxBrowserChecks({ page, base, output }) {
  assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "UI fixtures must stay local");
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const setField = async (selector, value) => {
    await page.evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Missing fixture field');const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  };
  const navigate = async route => {
    await page.go(route);
    await page.wait(`location.pathname===${JSON.stringify(new URL(route, base).pathname)}&&!!document.querySelector('header .name-current')`);
    if (route.startsWith("/admin/polls/new")) await page.wait("!!document.querySelector('.admin-form > fieldset')&&!document.querySelector('.admin-form > fieldset').disabled");
    if (route.startsWith("/board/new")) await page.wait("!!document.querySelector('.board-editor > fieldset')&&!document.querySelector('.board-editor > fieldset').disabled");
    if (route === "/polls") await page.wait("document.querySelectorAll('.poll-personal-state').length>0");
    if (route === "/") await page.wait("!!document.querySelector('.home-poll-summary')");
    // A full Page.navigate can reach document.complete just before React connects
    // client handlers. Board/Admin also have explicit ready/permission guards.
    await pause(120);
  };
  const viewport = async width => page.send("Emulation.setDeviceMetricsOverride", { width, height: width >= 1024 ? 960 : 900, deviceScaleFactor: 1, mobile: width < 768 });
  const noOverflow = async label => assert(await page.evaluate("document.documentElement.scrollWidth<=innerWidth"), `Horizontal overflow: ${label}`);
  const screenshot = async filename => {
    const result = await page.send("Page.captureScreenshot", { format: "png" });
    await writeFile(path.join(output, filename), Buffer.from(result.data, "base64"));
  };
  const openMenu = async () => {
    await page.evaluate("document.querySelector('.header-menu-toggle').focus();document.querySelector('.header-menu-toggle').click()");
    await page.wait("document.querySelector('.header-menu-toggle')?.getAttribute('aria-expanded')==='true'");
    assert(await page.evaluate("document.querySelector('.header-menu').getBoundingClientRect().height>0"));
  };
  const boardSnapshot = async () => page.evaluate("fetch('/api/board/posts',{cache:'no-store'}).then(r=>r.json()).then(v=>({total:v.total,pinned:v.pinned.map(p=>String(p.id)).sort()}))");

  for (const width of [320, 390, 430, 768, 1440]) {
    await viewport(width);
    for (const [route, label] of [["/", "home"], ["/polls", "polls"], ["/board", "board"], ["/admin/polls/new", "admin-new"]]) {
      await navigate(route);
      await noOverflow(`${width}px ${route}`);
      await page.wait(width >= 1024
        ? "document.querySelector('.site-nav')?.getBoundingClientRect().width>0&&getComputedStyle(document.querySelector('.header-menu-toggle')).display==='none'"
        : "document.querySelector('.header-menu-toggle')?.getBoundingClientRect().width>=44&&getComputedStyle(document.querySelector('.header-menu')).display==='none'");
      if ([390, 768, 1440].includes(width)) await screenshot(`ui-${label}-${width}.png`);
      if (width === 1440) {
        assert.equal(await page.evaluate("getComputedStyle(document.querySelector('.header-menu-toggle')).display"), "none");
        assert(await page.evaluate("document.querySelector('.site-nav').getBoundingClientRect().width>0"));
      } else {
        assert.notEqual(await page.evaluate("getComputedStyle(document.querySelector('.header-menu-toggle')).display"), "none");
        assert.equal(await page.evaluate("document.querySelector('.header-menu-toggle').getAttribute('aria-expanded')"), "false");
      }
    }
  }

  // Missing Home assets and a failed authenticated image request both preserve
  // layout; the private URL never goes through Next's public optimizer.
  await viewport(390); await navigate("/");
  assert(await page.evaluate("(()=>{const h=document.querySelector('.private-home-photo[data-image-state=fallback]')?.getBoundingClientRect().height;return h>=150&&h<=180;})()"));
  await navigate("/board");
  await page.wait("document.querySelector('.board-banner')?.getBoundingClientRect().height>=100");
  const bannerHeight = await page.evaluate("document.querySelector('.board-banner').getBoundingClientRect().height");
  await page.send("Network.setBlockedURLs", { urls: [base + "/api/site-images/boardBanner"] });
  try {
    await navigate("/board");
    await page.wait("!!document.querySelector('.board-banner [data-image-state=fallback]')");
    await page.wait("document.querySelector('.board-banner')?.getBoundingClientRect().height>=100");
    assert.equal(await page.evaluate("document.querySelector('.board-banner').getBoundingClientRect().height"), bannerHeight);
    assert.equal(await page.evaluate("!!document.querySelector('img[src*=\"_next/image\"][src*=\"site-images\"]')"), false);
  } finally { await page.send("Network.setBlockedURLs", { urls: [] }); }
  for (const route of ["/polls?participation=pending", "/polls/2026-q4?participation=pending"]) {
    await navigate(route);
    await page.wait("document.querySelectorAll('.poll-personal-state').length>0");
    assert(await page.evaluate("Array.from(document.querySelectorAll('.poll-personal-state')).every(el=>el.dataset.participation==='pending')"));
  }

  await viewport(390); await navigate("/");
  assert.equal(await page.evaluate("document.querySelectorAll('.site-nav a').length"), 5);
  await openMenu();
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  assert(await page.evaluate("document.activeElement.classList.contains('nav-link')"));
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await page.wait("document.querySelector('.header-menu-toggle').getAttribute('aria-expanded')==='false'");
  assert(await page.evaluate("document.activeElement===document.querySelector('.header-menu-toggle')"));
  await openMenu();
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: 12, y: 850, button: "left", clickCount: 1 });
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 12, y: 850, button: "left", clickCount: 1 });
  await page.wait("document.querySelector('.header-menu-toggle').getAttribute('aria-expanded')==='false'");
  await openMenu();
  await page.evaluate("document.querySelector('.site-nav a[href=\"/polls\"]').click()");
  await page.wait("location.pathname==='/polls'&&document.querySelector('.header-menu-toggle')?.getAttribute('aria-expanded')==='false'");
  assert.equal(await page.evaluate("document.querySelector('.site-nav a[href=\"/polls\"]').getAttribute('aria-current')"), "page");
  await noOverflow("open/closed mobile navigation");
  await page.wait("document.querySelectorAll('.poll-personal-state').length>0");
  assert(await page.evaluate("Array.from(document.querySelectorAll('.poll-personal-state')).every(p=>p.textContent.includes('내 참여'))"));

  await navigate("/admin/polls/new");
  assert(await page.evaluate("document.querySelector('.admin-setting-summary').textContent.includes('단일선택')"));
  await page.evaluate("document.querySelectorAll('input[name=vote-mode]')[1].click()");
  await page.wait("document.querySelector('.admin-setting-summary').textContent.includes('복수선택 · 선택지당 1표')");
  await page.evaluate("document.querySelectorAll('input[name=results-visibility]')[1].click()");
  await page.wait("document.querySelector('.admin-setting-summary').textContent.includes('투표 종료 후 공개')");
  await page.evaluate("document.querySelectorAll('input[name=poll-type]')[1].click()");
  await page.wait("!!document.querySelector('#text-max-length')&&!document.querySelector('#poll-option-0')");
  assert.equal(await page.evaluate("document.querySelector('#text-max-length').value"), "1000");
  assert(await page.evaluate("document.querySelector('.admin-setting-summary').textContent.includes('1인 1응답')"));
  assert.equal(await page.evaluate("document.querySelectorAll('input[name=vote-mode]').length"), 0);
  await setField("#text-max-length", "1234");
  await page.wait("document.querySelector('.admin-setting-summary').textContent.includes('1234자')");
  await page.evaluate("document.querySelectorAll('input[name=poll-type]')[0].click()");
  await page.wait("!!document.querySelector('#poll-option-0')&&!document.querySelector('#text-max-length')");
  await noOverflow("mobile Admin conditional fields and settings summary");

  const before = await boardSnapshot();
  await navigate("/board/new");
  assert.equal(await page.evaluate("document.querySelector('#board-content').hasAttribute('maxlength')"), false);
  assert.equal(await page.evaluate("document.querySelector('#board-title').hasAttribute('maxlength')"), false);
  await setField("#board-title", "코드포인트 경계 검증");
  await setField("#board-content", "  한글😀\n끝  ");
  await page.wait("document.querySelector('#board-content-count').textContent.startsWith('5 / 10000자')");
  await setField("#board-content", "😀".repeat(10000));
  await page.wait("document.querySelector('#board-content-count').textContent.startsWith('10000 / 10000자')&&!document.querySelector('.board-editor button[type=submit]').disabled");
  await setField("#board-title", "😀".repeat(160));
  await page.wait("document.querySelector('#board-title-count').textContent.startsWith('160 / 160자')&&!document.querySelector('.board-editor button[type=submit]').disabled");
  await setField("#board-title", "😀".repeat(161));
  await page.wait("document.querySelector('#board-title').getAttribute('aria-invalid')==='true'&&document.querySelector('.board-editor button[type=submit]').disabled");
  await setField("#board-title", "합성 초과 입력");
  await setField("#board-content", "가".repeat(10001));
  await page.wait("document.querySelector('#board-content').getAttribute('aria-invalid')==='true'&&document.querySelector('.board-editor button[type=submit]').disabled");
  assert.equal(await page.evaluate("fetch('/api/board/posts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Rejected synthetic overflow',content:'가'.repeat(10001),post_type:'general',is_pinned:false})}).then(r=>r.status)"), 400);
  assert.deepEqual(await boardSnapshot(), before);

  // Select an existing synthetic post through the protected API rather than
  // assuming an ID; no valid Board write is needed to exercise comment limits.
  const postId = await page.evaluate("fetch('/api/board/posts',{cache:'no-store'}).then(r=>r.json()).then(v=>String((v.posts[0]??v.pinned[0]).id))");
  await navigate(`/board/${postId}`);
  await page.wait("!!document.querySelector('#board-comment')&&!document.querySelector('#board-comment').disabled");
  assert.equal(await page.evaluate("document.querySelector('#board-comment').hasAttribute('maxlength')"), false);
  await setField("#board-comment", "😀".repeat(2000));
  await page.wait("document.querySelector('#board-comment-count').textContent.startsWith('2000 / 2000자')&&!document.querySelector('.board-comments button[type=submit]').disabled");
  await setField("#board-comment", "😀".repeat(2001));
  await page.wait("document.querySelector('#board-comment').getAttribute('aria-invalid')==='true'&&document.querySelector('.board-comments button[type=submit]').disabled");
  assert.equal(await page.evaluate(`fetch('/api/board/posts/${postId}/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:'😀'.repeat(2001)})}).then(r=>r.status)`), 400);

  await navigate("/board/new?type=notice");
  await page.wait("!!Array.from(document.querySelectorAll('.board-editor button')).find(b=>b.textContent==='결정 기록 양식 넣기')");
  await page.evaluate("Array.from(document.querySelectorAll('.board-editor button')).find(b=>b.textContent==='결정 기록 양식 넣기').click()");
  await page.wait("document.querySelector('#board-content').value.includes('최종 결정 내용')");
  assert(await page.evaluate("document.querySelector('#board-content').value.includes('관련 투표')&&document.querySelector('#board-content').value.includes('목표 일정')"));
  const draft = "관리자가 입력 중인 합성 본문";
  await setField("#board-content", draft);
  await page.wait(`document.querySelector('#board-content-count').textContent.startsWith(${JSON.stringify(`${Array.from(draft).length} / 10000자`)})`);
  await page.evaluate("window.confirm=()=>false;Array.from(document.querySelectorAll('.board-editor button')).find(b=>b.textContent==='결정 기록 양식 넣기').click()");
  assert.equal(await page.evaluate("document.querySelector('#board-content').value"), draft);
  assert.deepEqual(await boardSnapshot(), before);
  await noOverflow("mobile Board notice template");
  await screenshot("ui-notice-template-390.png");

  return [
    "UI layouts: 320/390/430/768/1440px Home, Polls, Board and Admin without horizontal overflow",
    "Mobile disclosure: keyboard navigation, Escape focus restoration, outside click, route close; desktop navigation stays visible",
    "Poll cards distinguish own participation from poll availability",
    "Pending filters work in current and past quarters; missing/failed private images keep their layout without the optimizer",
    "Korean Admin settings summary and choice/text conditional fields without saving a poll",
    "Board Unicode counts, exact emoji/Korean limits and disabled overflow submits match server validation",
    "Existing-post comment limit and invalid API input rejection without valid Board writes",
    "Administrator notice template preserves drafts on cancel and never auto-saves",
  ];
}
