import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";

// Local synthetic fixtures only. This suite navigates, prints and changes view
// controls; it never submits a new vote or changes a production record.
export async function runPresentationPollBrowser({ page, base, output }) {
  assert(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const viewport = width => page.send("Emulation.setDeviceMetricsOverride", { width, height: width >= 1024 ? 960 : 900, deviceScaleFactor: 1, mobile: width < 768 });
  const navigate = async route => {
    await page.go(route);
    await page.wait(`location.pathname===${JSON.stringify(new URL(route, base).pathname)}&&!!document.querySelector('header .name-current')`);
  };
  const screenshot = async name => {
    const image = await page.send("Page.captureScreenshot", { format: "png" });
    await writeFile(path.join(output, name), Buffer.from(image.data, "base64"));
  };
  const noOverflow = async label => assert(await page.evaluate("document.documentElement.scrollWidth<=innerWidth"), `Horizontal overflow: ${label}`);
  const presentationReady = async () => {
    await page.wait("document.querySelectorAll('[data-presentation-section]').length===12&&!document.querySelector('.presentation-toc-toggle')?.disabled");
    await page.wait("document.querySelector('.presentation-navigation')?.getBoundingClientRect().height>20");
  };
  await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  for (const width of [390, 768, 1440]) {
    await viewport(width); await navigate("/quarter/2026-q4"); await presentationReady();
    assert.equal(await page.evaluate("document.querySelectorAll('.presentation-slide').length"), 12);
    await page.evaluate("document.querySelector('.presentation-toc-toggle').click()");
    await page.wait("document.querySelector('.presentation-toc-toggle')?.getAttribute('aria-expanded')==='true'");
    assert.equal(await page.evaluate("document.querySelectorAll('.presentation-toc a').length"), 12);
    await page.evaluate("document.querySelector('.presentation-toc a[href=\"#scope\"]').click()");
    await page.wait("location.hash==='#scope'&&document.querySelector('.presentation-navigation [role=progressbar]')?.getAttribute('aria-valuenow')==='3'");
    assert.equal(await page.evaluate("document.querySelector('.presentation-toc-toggle').getAttribute('aria-expanded')"), "false");
    await page.evaluate("document.querySelector('button[aria-label=\"다음 섹션\"]').click()");
    await page.wait("location.hash==='#framework'&&document.querySelector('.presentation-navigation [role=progressbar]')?.getAttribute('aria-valuenow')==='4'");
    await page.evaluate("document.querySelector('button[aria-label=\"이전 섹션\"]').click()");
    await page.wait("location.hash==='#scope'");
    await page.evaluate("document.getElementById('total-cost').scrollIntoView({block:'start',behavior:'instant'})");
    await page.wait("document.querySelector('.presentation-navigation [role=progressbar]')?.getAttribute('aria-valuenow')==='10'");
    assert.equal(await page.evaluate("document.querySelector('.presentation-toc a[aria-current=location]').hash"), "#total-cost");
    await noOverflow(`${width}px presentation navigation`);
    await screenshot(`feature-presentation-${width}.png`);
    await page.evaluate("document.querySelector('.presentation-top').click()");
    await page.wait("location.hash==='#cover'&&document.querySelector('.presentation-navigation [role=progressbar]')?.getAttribute('aria-valuenow')==='1'");
  }

  await page.send("Emulation.setDeviceMetricsOverride", { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
  await navigate("/quarter/2026-q4"); await presentationReady();
  await page.evaluate("document.querySelector('button[aria-label=\"다음 섹션\"]').click()");
  await page.wait("location.hash==='#roadmap'&&document.querySelector('.presentation-navigation [role=progressbar]')?.getAttribute('aria-valuenow')==='2'");
  await noOverflow("landscape presentation navigation");
  await viewport(1440);

  // Browser PDF, not a new PDF backend. Confirm print controls are removed and
  // semantic sections can grow rather than being clipped into fixed frames.
  await page.send("Emulation.setEmulatedMedia", { media: "print" });
  try {
    await page.wait("getComputedStyle(document.querySelector('.presentation-navigation')).display==='none'");
    assert(await page.evaluate("Array.from(document.querySelectorAll('.presentation-slide')).every(section=>getComputedStyle(section).minHeight==='0px'&&getComputedStyle(section).overflow!=='hidden')"));
    assert(await page.evaluate("['page','always'].includes(getComputedStyle(document.querySelector('.presentation-slide')).breakBefore)"));
    assert.equal(await page.evaluate("getComputedStyle(document.querySelector('.deck-comments')).display"), "none");
    const pdf = await page.send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
    const bytes = Buffer.from(pdf.data, "base64");
    assert(bytes.length > 1000 && bytes.subarray(0, 4).toString() === "%PDF");
    await writeFile(path.join(output, "feature-presentation.pdf"), bytes);
  } finally { await page.send("Emulation.setEmulatedMedia", { media: "screen", features: [{ name: "prefers-reduced-motion", value: "reduce" }] }); }

  await page.evaluate("document.querySelector('.presentation-top').click()");
  await page.wait("document.querySelector('.presentation-navigation [role=progressbar]')?.getAttribute('aria-valuenow')==='1'");

  await page.send("Runtime.evaluate", { expression: "document.querySelector('.presentation-mode-toggle').click()", userGesture: true, awaitPromise: true, returnByValue: true });
  await page.wait("!!document.fullscreenElement||!!document.querySelector('.presentation-mode-message')");
  const fullscreen = await page.evaluate("!!document.fullscreenElement");
  if (fullscreen) {
    await page.wait("document.querySelector('.presentation-mode-toggle')?.textContent==='발표 종료'");
    await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
    await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
    await page.wait("location.hash==='#roadmap'");
    await page.send("Runtime.evaluate", { expression: "document.querySelector('.presentation-mode-toggle').click()", userGesture: true, awaitPromise: true, returnByValue: true });
    await page.wait("!document.fullscreenElement");
  } else assert(await page.evaluate("/지원하지|시작하지 못/.test(document.querySelector('.presentation-mode-message').textContent)"));

  await navigate("/archive?q=방향&year=2026");
  await page.wait("!!document.querySelector('.archive-filters')");
  assert(await page.evaluate("!!document.querySelector('.archive-section a[href=\"/quarter/2026-q4\"]')"));
  assert.equal(await page.evaluate("document.querySelector('#archive-year').value"), "2026");
  await navigate("/archive?q=fixture-does-not-match-any-quarter");
  assert.equal(await page.evaluate("document.querySelectorAll('.archive-section a[href^=\"/quarter/\"]').length"), 0);
  assert(await page.evaluate("!!document.querySelector('.archive-section .interaction-notice a[href=\"/archive\"]')"));

  // Derive expected fixture members from the protected API, never from a
  // client-supplied participant ID or a hardcoded aggregate result.
  const catalog = await page.evaluate("fetch('/api/polls',{cache:'no-store'}).then(r=>r.json())");
  const selectedSlugs = async () => page.evaluate("Array.from(document.querySelectorAll('article.poll-card h2 a')).map(a=>a.getAttribute('href').split('/').pop()).sort()");
  const filterChecks = [
    ["", "ACTIVE", null], ["?status=upcoming", "UPCOMING", null], ["?status=all", null, null],
    ["?participation=pending", "ACTIVE", false], ["?status=all&participation=done", null, true], ["?tab=closed", "CLOSED", null],
  ];
  for (const [query, status, participated] of filterChecks) {
    await navigate(`/polls/2026-q4${query}`);
    await page.wait("!!document.querySelector('nav[aria-label=\"내 참여 상태\"]')");
    const expected = catalog.filter(item => item.poll.quarter === "2026-q4" && item.status !== "HIDDEN"
      && (!status || item.status === status) && (participated === null || item.ownParticipation?.hasParticipated === participated)).map(item => item.poll.slug).sort();
    // The initial streaming header can precede the server collection.
    await page.wait(`document.querySelectorAll('article.poll-card').length===${expected.length}`);
    assert.deepEqual(await selectedSlugs(), expected);
    await noOverflow(`Poll filters ${query || "active"}`);
  }

  const validateResults = async (slug, multiple) => {
    await navigate(`/polls/${slug}`);
    await page.wait("!!document.querySelector('.poll-results .result-sort select')&&!document.querySelector('.poll-results .result-sort select').disabled");
    const data = await page.evaluate(`fetch('/api/polls/${slug}',{cache:'no-store'}).then(r=>r.json())`);
    const byVotes = [...data.options].sort((a, b) => (data.results.counts[b.id] ?? 0) - (data.results.counts[a.id] ?? 0) || a.display_order - b.display_order);
    await page.evaluate("(()=>{const select=document.querySelector('.result-sort select');select.value='votes';select.dispatchEvent(new Event('change',{bubbles:true}));})()");
    await page.wait(`(()=>{const labels=${JSON.stringify(byVotes.map(option => option.label))};const rows=Array.from(document.querySelectorAll('.poll-results ol > li'));return rows.length===labels.length&&rows.every((row,index)=>row.textContent.includes(labels[index]));})()`);
    const rows = await page.evaluate("Array.from(document.querySelectorAll('.poll-results ol > li')).map(li=>li.textContent)");
    assert.equal(rows.length, byVotes.length);
    const denominator = multiple ? data.results.participant_count : data.results.total_votes;
    byVotes.forEach((option, index) => {
      const count = data.results.counts[option.id] ?? 0;
      assert(rows[index].includes(option.label));
      assert(rows[index].includes(`${count}표 · ${denominator ? Math.round(count / denominator * 100) : 0}%`));
    });
    const maximum = Math.max(0, ...Object.values(data.results.counts));
    const leaders = data.options.filter(option => (data.results.counts[option.id] ?? 0) === maximum);
    if (maximum > 0 && leaders.length > 1) assert.equal(rows.filter(text => text.includes("공동 1위")).length, leaders.length);
    if (multiple) assert(await page.evaluate("document.querySelector('.poll-results').textContent.includes('참여자 기준 선택률')"));
    return data;
  };
  await viewport(390);
  const multi = await validateResults("ui-multi", true);
  assert(Object.values(multi.results.counts).filter(count => count > 0).length >= 2, "Choice fixture already supplies a tied multi ballot");
  await screenshot("feature-poll-results-390.png");
  await validateResults("land-priority", false);

  await navigate("/polls/ui-multi");
  await page.wait("!!document.querySelector('.copy-link-control button')&&!!document.querySelector('.poll-ballot section[aria-label=\"내 선택\"]')");
  await page.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.fixtureCopiedUrl=value;}}});document.querySelector('.copy-link-control button').click()");
  await page.wait("document.querySelector('.copy-link-control [role=status]')?.textContent.includes('복사했습니다')");
  assert.equal(await page.evaluate("window.fixtureCopiedUrl"), base + "/polls/ui-multi");
  await page.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('fixture clipboard denied');}}});document.querySelector('.copy-link-control button').click()");
  await page.wait("!!document.querySelector('input[aria-label=\"복사할 링크\"]')");
  assert.equal(await page.evaluate("document.querySelector('input[aria-label=\"복사할 링크\"]').value"), base + "/polls/ui-multi");

  const ownBefore = await page.evaluate("fetch('/api/polls/ui-multi/participation').then(r=>r.json())");
  await page.evaluate("Array.from(document.querySelectorAll('.poll-ballot button')).find(button=>button.textContent==='선택 변경하기').click()");
  await page.wait("document.querySelectorAll('.poll-ballot input[type=checkbox]').length===3");
  await page.evaluate("document.querySelector('.poll-ballot input[value=\"1402\"]').click()");
  await page.wait("document.querySelectorAll('.ballot-selection-summary li').length===3");
  assert.equal(await page.evaluate("!!document.querySelector('.poll-ballot [data-tone=success]')"), false);
  assert.deepEqual(await page.evaluate("fetch('/api/polls/ui-multi/participation').then(r=>r.json())"), ownBefore);
  await page.evaluate("Array.from(document.querySelectorAll('.poll-ballot form button[type=button]')).find(button=>button.textContent==='취소').click()");
  await page.wait("!document.querySelector('.poll-ballot form')&&document.querySelectorAll('.poll-ballot section[aria-label=\"내 선택\"] li').length===2");
  await navigate("/polls/choice-private");
  await page.wait("!!document.querySelector('.poll-interaction h2')");
  assert.equal(await page.evaluate("!!document.querySelector('.poll-results')||!!document.querySelector('.participation-rate')"), false);
  await pause(100);
  await noOverflow("private results and copy/summary controls");
  return [
    "Presentation 12-section TOC/anchors/previous-next/top/scroll progress at 390/768/1440px",
    `Browser PDF print styles and artifact; fullscreen ${fullscreen ? "entered, keyboard navigated and exited" : "unsupported/rejected with usable feedback"}`,
    "Published Archive search/year hit and empty states",
    "Active/upcoming/all/personal/legacy-closed filters match the session-only API",
    "Choice result ranking/ties and single/multiple denominator interpretations",
    "Clipboard success and permission-denied manual fallback; draft selection summary never submits",
    "Unpublished result counts and participation rate remain absent",
  ];
}
