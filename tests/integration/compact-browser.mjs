import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export async function runCompactBrowserChecks({ page, base, output }) {
  assert.equal(new URL(base).hostname, "127.0.0.1");
  const measurements = [];
  const navigate = async route => {
    await page.go(route);
    await page.wait("!!document.querySelector('header .name-current')");
    // The streamed heading can precede visible content in a hidden fragment.
    // Measure the displayed collection, rather than racing its insertion.
    const visible = route === "/" ? ".home-poll-summary" : route === "/admin" ? ".admin-dashboard-stats" : route === "/board" ? ".board-row" : route === "/archive" ? ".archive-link" : ".poll-list-card";
    await page.wait(`document.querySelector(${JSON.stringify(visible)})?.getBoundingClientRect().height>0`);
    await page.evaluate("window.scrollTo({top:0,behavior:'instant'})");
  };
  for (const width of [390, 768, 1440]) {
    await page.send("Emulation.setDeviceMetricsOverride", { width, height: width >= 1024 ? 960 : 900, deviceScaleFactor: 1, mobile: width < 768 });
    for (const [route, name] of [["/", "home"], ["/polls/2026-q4", "polls"], ["/board", "board"], ["/archive", "archive"], ["/admin", "admin"]]) {
      await navigate(route);
      assert(await page.evaluate("document.documentElement.scrollWidth<=innerWidth"), `${width}px ${route} overflow`);
      if (route === "/") {
        assert.deepEqual(await page.evaluate("Array.from(document.querySelectorAll('main.home-page > section[data-home-section]')).map(e=>e.dataset.homeSection)"), ["intro", "presentation", "polls", "status", "decisions", "notices", "roadmap", "candidates"]);
        assert(await page.evaluate("document.querySelector('[data-home-section=presentation]').nextElementSibling.dataset.homeSection==='polls'"));
        assert.equal(await page.evaluate("document.querySelectorAll('[data-home-section=status] dl').length"), 0);
        assert(await page.evaluate("document.querySelector('[data-home-section=status]').textContent.includes('논의 후 업데이트됩니다')"));
        assert.equal(await page.evaluate("!!document.querySelector('[data-home-section=events]')"), false);
        assert(await page.evaluate("document.querySelector('[data-home-section=decisions]').textContent.includes('합성 결정 공지')"));
        assert.equal(await page.evaluate("document.querySelector('[data-home-section=decisions]').textContent.includes('fixture-decision-body-not-for-home')"), false);
        assert.equal(await page.evaluate("!!document.querySelector('[data-home-section=decisions] a[href=\"/polls/hidden\"]')"), false);
        assert.equal(await page.evaluate("!!document.querySelector('[data-home-section=notices] a[href=\"/board/90\"]')"), false);
        assert(await page.evaluate("document.querySelectorAll('[data-home-section=polls] article.poll-card').length<=3"));
        assert.equal(await page.evaluate("!!document.querySelector('.home-poll-priorities')||!!document.querySelector('[data-home-section=polls] .participation-rate')"), false);
        const latest = await page.evaluate("(()=>{const a=document.querySelector('.current-copy .primary-link');return{ctaTop:a.getBoundingClientRect().top,ctaBottom:a.getBoundingClientRect().bottom,heroHeight:document.querySelector('.private-home-photo').getBoundingClientRect().height,pollsTop:document.querySelector('[data-home-section=polls]').getBoundingClientRect().top};})()");
        assert(latest.ctaBottom <= (width >= 1024 ? 960 : 900), "Latest presentation action should appear in the first screen");
        assert(latest.heroHeight <= (width < 768 ? 180 : 240));
        measurements.push({ width, page: name, ...latest });
      } else if (route === "/board") {
        assert.equal(await page.evaluate("!!document.querySelector('.board-identity')"), false);
        const board = await page.evaluate("(()=>{const r=document.querySelector('.board-row');return{bannerHeight:document.querySelector('.board-banner').getBoundingClientRect().height,toolbarTop:document.querySelector('.board-toolbar').getBoundingClientRect().top,firstRowTop:r?.getBoundingClientRect().top,rowHeight:r?.getBoundingClientRect().height,writeAction:!!document.querySelector('.board-write-links .interaction-button')};})()");
        assert(board.bannerHeight <= (width < 768 ? 120 : 160)); assert(board.writeAction); assert(board.rowHeight <= 96);
        assert(board.firstRowTop > board.toolbarTop); measurements.push({ width, page: name, ...board });
        await page.evaluate("document.querySelector('.board-row').scrollIntoView({block:'center',behavior:'instant'})");
        assert(await page.evaluate("(()=>{const row=document.querySelector('.board-row'),r=row.getBoundingClientRect();return document.elementFromPoint(r.left+r.width/2,r.bottom-3)?.closest('a')===row.querySelector('.board-row-title');})()"), "The whole compact Board row remains a touch target");
        await page.evaluate("window.scrollTo({top:0,behavior:'instant'})");
      } else if (route === "/archive") {
        assert.equal(await page.evaluate("document.querySelector('.archive-filter-panel').open"), false);
        assert(await page.evaluate("!!document.querySelector('.archive-link[href=\"/quarter/2026-q4\"]')"));
        await page.evaluate("document.querySelector('.archive-filter-panel summary').click()");
        assert(await page.evaluate("document.querySelector('#archive-search').getBoundingClientRect().height>=44"));
        await page.evaluate("document.querySelector('.archive-filter-panel summary').click()");
      } else if (route === "/admin") {
        assert(await page.evaluate("!!document.querySelector('.admin-workspace-actions a[href=\"/admin/polls/new\"]')&&!!document.querySelector('.admin-workspace-actions a[href=\"/board/new?type=notice\"]')"));
        assert(await page.evaluate("document.querySelector('.admin-workspace-actions').getBoundingClientRect().top<document.querySelector('.admin-dashboard-stats').getBoundingClientRect().top"));
      } else {
        await page.wait("document.querySelectorAll('.poll-list-card').length>0");
        assert(await page.evaluate("Array.from(document.querySelectorAll('.poll-card-details')).every(e=>!e.open)"));
        await page.evaluate("document.querySelector('.poll-card-details summary').click()");
        assert(await page.evaluate("document.querySelector('.poll-card-details').open&&!!document.querySelector('.poll-card-details .poll-meta')"));
        await page.evaluate("document.querySelector('.poll-card-details summary').click()");
      }
      const shot = await page.send("Page.captureScreenshot", { format: "png" });
      await writeFile(path.join(output, `compact-${name}-${width}.png`), Buffer.from(shot.data, "base64"));
    }
  }
  await writeFile(path.join(output, "compact-measurements.json"), JSON.stringify(measurements, null, 2) + "\n");
  const control = async body => fetch("http://127.0.0.1:3103/_test", { method: "POST", body: JSON.stringify(body) });
  try {
    await control({ homeBoardMode: "empty" }); await navigate("/");
    await page.wait("!Array.from(document.querySelectorAll('[role=status]')).some(e=>e.getBoundingClientRect().height>0&&e.textContent.includes('공지와 결정사항을 불러오는 중'))");
    assert.equal(await page.evaluate("!!document.querySelector('[data-home-section=notices],[data-home-section=decisions],[data-home-section=events]')"), false);
    await control({ homeBoardMode: "error" }); await navigate("/");
    await page.wait("Array.from(document.querySelectorAll('[role=status]')).some(e=>e.getBoundingClientRect().height>0&&e.textContent.includes('공지와 결정사항을 불러오지 못했습니다'))");
    assert.equal(await page.evaluate("document.body.textContent.includes('fixture-private-board-outage')"), false);
  } finally { await control({ homeBoardMode: null }); }
  for (const width of [390, 768, 1440]) {
    await page.send("Emulation.setDeviceMetricsOverride", { width, height: 960, deviceScaleFactor: 1, mobile: width < 768 });
    await page.go("/fixture-project-status");
    await page.wait("!!document.querySelector('.home-status-facts')");
    assert.equal(await page.evaluate("document.querySelectorAll('.home-status-facts > div').length"), 3);
    assert(await page.evaluate("!!document.querySelector('.home-tasks a[href=\"/quarter/2026-q4\"]')"));
    assert.equal(await page.evaluate("document.body.textContent.includes('노출되면 안 되는 외부 링크')||document.body.textContent.includes('합성 과거 일정')"), false);
    assert.equal(await page.evaluate("document.querySelectorAll('[data-home-section=events] li').length"), 1);
    assert(await page.evaluate("document.documentElement.scrollWidth<=innerWidth"));
  }
  return ["Compact Home preserves adjacent presentation/polls, explicit decisions and null status, with empty events absent and a first-screen presentation action", "Compact Board rows/banner, Archive disclosure, Poll details/filters and Admin primary actions work without overflow at 390/768/1440px", "Empty Home sections disappear, outages recover, and configured goal/action/internal links plus real future events fit at 390/768/1440px"];
}
