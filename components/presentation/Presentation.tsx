import type { ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { isPresentationPublished, type Quarter } from "@/data/quarters";
import { requireAccessSession } from "@/lib/auth/session";
import { notFound } from "next/navigation";
import Link from "next/link";
import { RelatedContent } from "@/components/RelatedContent";
import { PresentationNavigator } from "./PresentationNavigator";
import { PresentationTheme } from "./theme/PresentationTheme";

type PresentationProps = {
  quarter: Quarter;
  children: ReactNode;
  theme?: "devicebook";
};

export async function Presentation({ quarter, children, theme }: PresentationProps) {
  await requireAccessSession(`/quarter/${quarter.slug}`);
  if (!isPresentationPublished(quarter.slug)) notFound();
  if (theme === "devicebook") return <PresentationTheme review={false}
    header={<SiteHeader quarter={quarter} />}
    footer={<><aside className="site-container presentation-related"><Link href={`/polls/${quarter.slug}`} className="text-link">이 분기의 투표 보기 →</Link><RelatedContent quarter={quarter.slug} /></aside><SiteFooter presentation /></>}>
    {children}
  </PresentationTheme>;
  return (
    <>
      <SiteHeader quarter={quarter} />
      <PresentationNavigator key={quarter.slug} />
      <main id="main-content" tabIndex={-1} className="presentation">{children}</main>
      <aside className="site-container presentation-related"><Link href={`/polls/${quarter.slug}`} className="text-link">이 분기의 투표 보기 →</Link><RelatedContent quarter={quarter.slug} /></aside>
      <SiteFooter presentation />
    </>
  );
}
