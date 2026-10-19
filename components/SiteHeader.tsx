import Link from "next/link";
import type { Quarter } from "@/data/quarters";
import { NameSelector } from "@/components/interactive/NameSelector";

type SiteHeaderProps = {
  quarter?: Quarter;
};

export function SiteHeader({ quarter }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="site-container header-inner">
        <Link href="/" className="wordmark" aria-label="203 PROJECT 홈">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>203 PROJECT</span>
        </Link>
        <nav aria-label="주요 탐색" className="flex items-center gap-5 text-sm sm:gap-8">
          <Link
            href="/"
            aria-current={quarter ? undefined : "page"}
            className="nav-link"
          >
            Home
          </Link>
          {quarter ? (
            <span className="quarter-badge">{quarter.year} Q{quarter.quarter}</span>
          ) : (
            <a href="#archive" className="nav-link">Archive</a>
          )}
        </nav>
        <NameSelector />
      </div>
    </header>
  );
}
