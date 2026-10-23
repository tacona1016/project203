import Link from "next/link";
import type { Quarter } from "@/data/quarters";
import { NameSelector } from "@/components/interactive/NameSelector";
import { LockSiteButton } from "@/components/access/LockSiteButton";
import { SiteNav } from "@/components/SiteNav";

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
        <SiteNav />
        <div className="header-user"><NameSelector /><LockSiteButton /></div>
        {quarter && <span className="header-quarter">{quarter.year} Q{quarter.quarter}</span>}
      </div>
    </header>
  );
}
