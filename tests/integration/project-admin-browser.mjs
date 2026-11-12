import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";

// Real Chrome + Next server, with isolated protocol fixtures (not PostgreSQL).
export async function runProjectAdminBrowser({ page, base, output }) {
  assert.equal(new URL(base).hostname, "127.0.0.1");
  const control = async body => fetch("http://127.0.0.1:3103/_test", { method: "POST", body: JSON.stringify(body) });
  const fill = async (selector, value) => page.evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const tab = async label => page.evaluate(`Array.from(document.querySelectorAll('.project-admin-tabs button')).find(b=>b.textContent===${JSON.stringify(label)}).click()`);
  const save = async () => {
    await page.evaluate("document.querySelector('.project-admin-form').requestSubmit()");
    await page.wait("document.querySelector('.project-admin [role=status]')?.textContent.includes('저장되었습니다')&&!document.querySelector('.project-admin-form fieldset').disabled");
  };
  await control({ projectMode: "missing" }); await page.go("/admin/project");
  await page.wait("!!document.querySelector('.project-admin-form fieldset')");
  assert(await page.evaluate("document.querySelector('.project-admin-form fieldset').disabled&&document.body.textContent.includes('관리 DB가 아직 적용되지 않았습니다')"));
  await control({ projectMode: "database", projectReset: true });
  try {
    await page.go("/admin/project"); await page.wait("!!document.querySelector('#project-phase')&&!document.querySelector('.project-admin-form fieldset').disabled");
    await fill("#project-phase", "Synthetic browser phase"); await fill("#project-goal", "Synthetic discussion");
    await fill("#project-next", "Synthetic next action"); await fill("#project-date", "2026-11-11"); await save();
    await tab("공동 일정"); await fill("#project-event-title", "Synthetic browser event");
    await fill("#project-event-start", "2099-01-01T10:30"); await fill("#project-event-place", "TEST only"); await save();
    await tab("결정사항");
    await page.evaluate("(()=>{const el=document.querySelector('#decision-post');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'90');el.dispatchEvent(new Event('change',{bubbles:true}));})()");
    await fill("#decision-date", "2026-11-11"); await save();
    for (const width of [390, 768, 1440]) {
      await page.send("Emulation.setDeviceMetricsOverride", { width, height: 960, deviceScaleFactor: 1, mobile: width < 768 });
      assert(await page.evaluate("document.documentElement.scrollWidth<=innerWidth"), `Project admin overflow ${width}`);
      const image = await page.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
      await writeFile(path.join(output, `project-admin-${width}.png`), Buffer.from(image.data, "base64"));
      await page.go("/"); await page.wait("!!document.querySelector('[data-home-section=status]')&&document.body.textContent.includes('Synthetic browser phase')");
      await page.wait("document.body.textContent.includes('Synthetic browser event')&&!!document.querySelector('[data-home-section=decisions] a[href=\"/board/90\"]')");
      assert(await page.evaluate("document.body.textContent.includes('Synthetic browser event')&&!!document.querySelector('[data-home-section=decisions] a[href=\"/board/90\"]')"));
      assert(await page.evaluate("document.documentElement.scrollWidth<=innerWidth"), `Managed Home overflow ${width}`);
      await page.go("/admin/project"); await page.wait("!!document.querySelector('.project-admin-tabs')");
    }
    await tab("변경 이력"); await page.wait("document.querySelectorAll('.project-revision').length>=3");
    await page.evaluate("document.querySelector('.project-revision').open=true");
    assert(await page.evaluate("!!document.querySelector('.project-revision button')"));
  } finally {
    await control({ projectMode: "missing" });
    await page.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  }
  return ["Project admin missing-schema read-only state; status/event/explicit decision saves and recoverable history; Home reflects changes at 390/768/1440px without overflow (synthetic DB)"];
}
