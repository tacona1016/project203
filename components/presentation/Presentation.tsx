import type { ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import type { Quarter } from "@/data/quarters";
import { requireAccessSession } from "@/lib/auth/session";

type PresentationProps = {
  quarter: Quarter;
  children: ReactNode;
};

export async function Presentation({ quarter, children }: PresentationProps) {
  await requireAccessSession(`/quarter/${quarter.slug}`);
  return (
    <>
      <SiteHeader quarter={quarter} />
      <main id="main-content" tabIndex={-1} className="presentation">{children}</main>
      <SiteFooter presentation />
    </>
  );
}
