import type { ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { isPresentationPublished, type Quarter } from "@/data/quarters";
import { requireAccessSession } from "@/lib/auth/session";
import { notFound } from "next/navigation";
<<<<<<< HEAD
=======
import Link from "next/link";
import { RelatedContent } from "@/components/RelatedContent";
import { PresentationNavigator } from "./PresentationNavigator";
>>>>>>> e9843ed (.)

type PresentationProps = {
  quarter: Quarter;
  children: ReactNode;
};

export async function Presentation({ quarter, children }: PresentationProps) {
  await requireAccessSession(`/quarter/${quarter.slug}`);
  if (!isPresentationPublished(quarter.slug)) notFound();
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
