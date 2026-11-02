"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { Quarter } from "@/data/quarters";
import { NameSelector } from "@/components/interactive/NameSelector";
import { LockSiteButton } from "@/components/access/LockSiteButton";
import { SiteNav } from "@/components/SiteNav";

type SiteHeaderProps = {
  quarter?: Quarter;
};

export function SiteHeader({ quarter }: SiteHeaderProps) {
  const pathname = usePathname();
  // A new route starts with a closed disclosure, without a page-wide client boundary.
  return <HeaderContents key={pathname} quarter={quarter} />;
}

function HeaderContents({ quarter }: SiteHeaderProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: Event) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    }
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onResize = () => { if (desktop.matches) setOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    desktop.addEventListener("change", onResize);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
      desktop.removeEventListener("change", onResize);
    };
  }, [open]);

  return (
    <header className="site-header" ref={root} data-menu-open={open}>
      <div className="site-container header-inner">
        <Link href="/" className="wordmark" aria-label="203 PROJECT 홈" onClick={() => setOpen(false)}>
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>203 PROJECT</span>
        </Link>
        <div className="header-member"><NameSelector /></div>
        <button ref={trigger} type="button" className="header-menu-toggle" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(value => !value)}>
          <span>{open ? "닫기" : "메뉴"}</span>
          <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
            {open ? <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.5" /> : <path d="M3 6h14M3 14h14" stroke="currentColor" strokeWidth="1.5" />}
          </svg>
        </button>
        <div id={menuId} className={`header-menu${open ? " is-open" : ""}`}>
          <SiteNav onNavigate={() => setOpen(false)} />
          <div className="header-user"><NameSelector /><LockSiteButton /></div>
        </div>
        {quarter && <span className="header-quarter">{quarter.year} Q{quarter.quarter}</span>}
      </div>
    </header>
  );
}
