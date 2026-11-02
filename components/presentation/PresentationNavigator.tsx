"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

type Section = { id: string; number: string; label: string };

export function PresentationNavigator() {
  const [sections, setSections] = useState<Section[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [message, setMessage] = useState("");
  const root = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const tocId = useId();

  useEffect(() => {
    let observer: IntersectionObserver | undefined;
    const initialize = () => {
      const elements = Array.from(document.querySelectorAll<HTMLElement>(".presentation [data-presentation-section]"));
      const items = elements.map(element => ({ id: element.id, number: element.dataset.sectionNumber ?? "", label: element.dataset.sectionLabel ?? "" }))
        .filter((item, index, all) => item.id && item.label && all.findIndex(other => other.id === item.id) === index);
      setSections(previous => previous.map(item => item.id).join("|") === items.map(item => item.id).join("|") ? previous : items);
      const update = () => {
        const padding = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
        const reference = Math.min(window.innerHeight - 1, Math.max(window.innerHeight * 0.3, padding + 1));
        let index = 0;
        items.forEach((item, position) => { if ((document.getElementById(item.id)?.getBoundingClientRect().top ?? Infinity) <= reference) index = position; });
        setActive(index);
      };
      observer?.disconnect();
      observer = new IntersectionObserver(update, { rootMargin: "-25% 0px -65% 0px", threshold: [0, 0.01] });
      elements.forEach(element => observer?.observe(element));
      update();
    };
    const frame = window.requestAnimationFrame(initialize);
    window.addEventListener("load", initialize);
    return () => { window.cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener("load", initialize); };
  }, []);

  const goTo = useCallback((index: number) => {
    const section = sections[index];
    if (!section) return;
    const target = document.getElementById(section.id);
    if (!target) return;
    const hash = `#${encodeURIComponent(section.id)}`;
    if (window.location.hash !== hash) window.history.pushState(window.history.state, "", hash);
    // Immediate movement keeps rapid previous/next actions and the observer's
    // visible section in sync; normal page scrolling remains native.
    target.scrollIntoView({ behavior: "instant", block: "start" });
    setActive(index); setOpen(false);
  }, [sections]);

  useEffect(() => {
    const sync = () => {
      const value = document.fullscreenElement === document.documentElement;
      setFullscreen(value);
      document.documentElement.classList.toggle("presentation-fullscreen", value);
    };
    document.addEventListener("fullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync); document.documentElement.classList.remove("presentation-fullscreen");
      if (document.fullscreenElement === document.documentElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape" && open) { setOpen(false); toggle.current?.focus(); return; }
      if (!fullscreen || event.altKey || event.ctrlKey || event.metaKey
        || event.target instanceof HTMLElement && (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))) return;
      if (event.key === "ArrowRight" || event.key === "PageDown") { event.preventDefault(); goTo(Math.min(active + 1, sections.length - 1)); }
      if (event.key === "ArrowLeft" || event.key === "PageUp") { event.preventDefault(); goTo(Math.max(active - 1, 0)); }
    }
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("keydown", keydown);
    if (open) document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", keydown); document.removeEventListener("pointerdown", outside); };
  }, [active, fullscreen, goTo, open, sections.length]);

  async function toggleFullscreen() {
    setMessage("");
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else setMessage("이 브라우저는 전체화면을 지원하지 않습니다. 아래 이동 버튼으로 발표해주세요.");
    } catch { setMessage("전체화면을 시작하지 못했습니다. 아래 이동 버튼을 사용할 수 있습니다."); }
  }

  return <nav ref={root} className="presentation-navigation" aria-label="발표자료 탐색">
    <div className="site-container presentation-navigation-inner">
      <button ref={toggle} type="button" className="text-link presentation-toc-toggle" aria-expanded={open} aria-controls={tocId} onClick={() => setOpen(value => !value)} disabled={!sections.length}>목차 {open ? "닫기" : "열기"}</button>
      <span className="presentation-position" aria-label={`현재 ${sections.length ? active + 1 : 0} / ${sections.length}장`}><strong>{sections.length ? String(active + 1).padStart(2, "0") : "—"}</strong> / {sections.length || "—"}</span>
      <div className="presentation-step-actions">
        <button type="button" className="text-link" disabled={!sections.length || active === 0} onClick={() => goTo(active - 1)} aria-label="이전 섹션">← 이전</button>
        <button type="button" className="text-link" disabled={!sections.length || active >= sections.length - 1} onClick={() => goTo(active + 1)} aria-label="다음 섹션">다음 →</button>
        <button type="button" className="text-link presentation-top" onClick={() => goTo(0)} disabled={!sections.length}>맨 위로</button>
        <button type="button" className="text-link presentation-mode-toggle" onClick={toggleFullscreen}>{fullscreen ? "발표 종료" : "발표 모드"}</button>
      </div>
      <div className="presentation-progress" role="progressbar" aria-label="발표자료 읽기 진행률" aria-valuemin={0} aria-valuemax={sections.length || 1} aria-valuenow={sections.length ? active + 1 : 0}><span style={{ width: sections.length ? `${(active + 1) / sections.length * 100}%` : "0%" }} /></div>
      <ol id={tocId} className="presentation-toc" hidden={!open}>
        {sections.map((section, index) => <li key={section.id}><a href={`#${encodeURIComponent(section.id)}`} aria-current={active === index ? "location" : undefined} onClick={event => { event.preventDefault(); goTo(index); }}><span>{section.number || String(index + 1).padStart(2, "0")}</span>{section.label}</a></li>)}
      </ol>
      {message && <p className="form-note presentation-mode-message" role="status">{message}</p>}
    </div>
  </nav>;
}
