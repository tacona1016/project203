import type { ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { isPresentationPublished, type Quarter } from "@/data/quarters";
import { requireAccessSession } from "@/lib/auth/session";
import { notFound } from "next/navigation";

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
      <main id="main-content" tabIndex={-1} className="presentation">{children}</main>
      <SiteFooter presentation />
    </>
  );
}
