"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [["/", "홈"], ["/archive", "발표자료"], ["/polls", "투표"], ["/board", "게시판"], ["/admin", "관리"]] as const;
export function SiteNav({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();
  return <nav aria-label="주요 탐색" className="site-nav">{items.map(([href, label]) => {
    const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/") || (href === "/archive" && pathname.startsWith("/quarter/"));
    return <Link key={href} href={href} aria-current={active ? "page" : undefined} className="nav-link" onClick={onNavigate}>{label}</Link>;
  })}</nav>;
}
