import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function runBrowser({ base, id, aPassword, bPassword }) {
  const output = path.resolve(".verification/member-browser"); await mkdir(output, { recursive: true });
  const pause = ms => new Promise(r => setTimeout(r, ms));
  let browser, sockets = [];
  async function launch() {
    browser = spawn(process.env.BROWSER_BIN ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--disable-gpu", "--in-process-gpu", "--no-sandbox", "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--remote-debugging-port=9230", `--user-data-dir=${path.join(output, "profile")}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
    for (let i = 0; i < 100; i++) { try { const tabs = await (await fetch("http://127.0.0.1:9230/json/list")).json(); if (tabs.length) return connect(tabs.find(t => t.type === "page")); } catch {} await pause(100); }
    throw Error("Chrome did not start; set BROWSER_BIN to its executable");
  }
  async function connect(tab) {
    const socket = new WebSocket(tab.webSocketDebuggerUrl); sockets.push(socket);
    await new Promise(resolve => socket.addEventListener("open", resolve, { once: true }));
    let sequence = 0; const pending = new Map();
    socket.addEventListener("message", ({ data }) => { const m = JSON.parse(data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); clearTimeout(p.timer); if (m.error) p.reject(Error("CDP request failed")); else p.resolve(m.result); } });
    const send = (method, params = {}) => new Promise((resolve, reject) => { const n = ++sequence; const timer = setTimeout(() => reject(Error("CDP timeout: " + method)), 15000); pending.set(n, { resolve, reject, timer }); socket.send(JSON.stringify({ id: n, method, params })); });
    const evaluate = async expression => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error("Browser evaluation failed"); return r.result.value; };
    const wait = async expression => { for (let i = 0; i < 150; i++) { if (await evaluate(expression)) return; await pause(100); } throw Error("Browser state did not settle: " + expression); };
    const go = async route => { await send("Page.navigate", { url: base + route }); await wait("document.readyState==='complete'&&!!document.querySelector('h1')"); };
    await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
    return { send, evaluate, wait, go };
  }
  async function login(page, person, password) {
    await page.wait("!!document.querySelector('select[name=participantId]')&&!document.querySelector('select[name=participantId]').disabled&&!document.querySelector('input[name=password]').disabled");
    assert.equal(await page.evaluate("['minlength','maxlength','pattern'].some(name=>document.querySelector('input[name=password]').hasAttribute(name))"), false);
    // Password-manager-style DOM updates, deliberately without input events.
    await page.evaluate(`(()=>{document.querySelector('select[name=participantId]').value=${JSON.stringify(id(person))};const el=document.querySelector('input[name=password]');el.focus();el.value=${JSON.stringify(password)};})()`);
    await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
    await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    await page.wait(`!!document.querySelector('header .name-current')&&document.querySelector('header .name-current').textContent==='친구${person}'`);
  }
  async function close() {
    if (sockets[0]?.readyState === WebSocket.OPEN) { const socket = sockets[0]; socket.send(JSON.stringify({ id: 999999, method: "Browser.close" })); }
    await pause(500); for (const socket of sockets) socket.close(); sockets = [];
    if (browser?.exitCode === null) { await Promise.race([new Promise(r => browser.once("exit", r)), pause(2000)]); if (browser.exitCode === null) browser.kill(); }
  }
  try {
    let page = await launch(); await page.send("Network.clearBrowserCookies");
    await page.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
    await page.go("/quarter/2026-q4"); await page.wait("location.pathname==='/access'");
    await page.evaluate(`localStorage.setItem('project203_participant',JSON.stringify({id:${JSON.stringify(id(2))},display_name:'친구2'}))`);
    await login(page, 1, aPassword); await page.wait("location.pathname==='/quarter/2026-q4'");
    assert.equal(await page.evaluate("!!document.querySelector('dialog')"), false);
    assert.equal(await page.evaluate("document.querySelectorAll('.presentation-slide').length"), 12);
    assert(await page.evaluate("document.documentElement.scrollWidth<=innerWidth"));
    await page.go("/board/new"); await page.wait("!!document.querySelector('.board-editor fieldset')&&!document.querySelector('.board-editor fieldset').disabled");
    assert.equal(await page.evaluate("!!document.querySelector('.board-identity input[type=password]')"), false);
    await page.evaluate("(()=>{for(const [selector,value] of [['#board-title','Browser fixture story'],['#board-content','Browser fixture content']]){const el=document.querySelector(selector);Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));}})()");
    await pause(100); await page.evaluate("document.querySelector('.board-editor button[type=submit]').click()");
    await page.wait("document.querySelector('h1')?.textContent==='Browser fixture story'");
    assert(await page.evaluate("document.documentElement.scrollWidth<=innerWidth"));
    const image = await page.send("Page.captureScreenshot", { format: "png" }); await writeFile(path.join(output, "board-390.png"), Buffer.from(image.data, "base64"));
    const created = await page.send("Target.createTarget", { url: base + "/board" });
    const tabs = await (await fetch("http://127.0.0.1:9230/json/list")).json(); const other = await connect(tabs.find(t => t.id === created.targetId));
    await other.wait("document.querySelector('header .name-current')?.textContent==='친구1'");
    await page.evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='로그아웃').click()");
    await page.wait("location.pathname==='/access'"); await other.wait("location.pathname==='/access'");
    assert.equal(await other.evaluate("fetch('/api/access/session').then(r=>r.status)"), 401);
    await login(page, 2, bPassword); await page.go("/archive");
    await page.wait("document.querySelector('header .name-current')?.textContent==='친구2'");
    await page.send("Page.reload"); await page.wait("document.readyState==='complete'&&document.querySelector('header .name-current')?.textContent==='친구2'");
    const cookies = await page.send("Network.getCookies", { urls: [base] }); const member = cookies.cookies.find(c => c.name === "project203_member");
    assert(member.httpOnly && member.sameSite === "Lax" && member.expires > Date.now() / 1000 + 29 * 86400);
    await close(); page = await launch();
    const diskCookies = await page.send("Network.getCookies", { urls: [base] });
    const persistedFromDisk = diskCookies.cookies.some(c => c.name === "project203_member");
    // Windows sandbox Chrome cannot always reopen its encrypted cookie store.
    // Restore only the synthetic cookie in memory to separately verify restart validity.
    if (!persistedFromDisk) await page.send("Network.setCookies", { cookies: [{ name: member.name, value: member.value, domain: member.domain, path: member.path, expires: member.expires, httpOnly: member.httpOnly, secure: member.secure, sameSite: member.sameSite }] });
    await page.go("/board"); await page.wait("document.querySelector('header .name-current')?.textContent==='친구2'");
    await writeFile(path.join(output, "report.json"), JSON.stringify({ status: "passed", persistedFromDisk, restartMethod: persistedFromDisk ? "browser cookie store" : "synthetic persistent cookie restored in memory; OS persistence unverified", checks: ["Mobile login via autofill/Enter", "Old localStorage ignored", "Original presentation return path and 12 slides", "Board creation without extra password", "Two-tab logout and API denial", "Refresh and saved-cookie validity after browser restart"] }, null, 2));
  } finally { await close(); }
}
