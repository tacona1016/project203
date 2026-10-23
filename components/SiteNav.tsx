"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [["/", "HOME"], ["/archive", "ARCHIVE"], ["/polls", "POLLS"], ["/admin", "ADMIN"]] as const;
export function SiteNav() {
  const pathname = usePathname();
  return <nav aria-label="주요 탐색" className="site-nav">{items.map(([href, label]) => {
    const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/") || (href === "/archive" && pathname.startsWith("/quarter/"));
    return <Link key={href} href={href} aria-current={active ? "page" : undefined} className="nav-link">{label}</Link>;
  })}</nav>;
}
