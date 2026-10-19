import type { ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import type { Quarter } from "@/data/quarters";

type PresentationProps = {
  quarter: Quarter;
  children: ReactNode;
};

export function Presentation({ quarter, children }: PresentationProps) {
  return (
    <>
      <SiteHeader quarter={quarter} />
      <main id="main-content" tabIndex={-1} className="presentation">{children}</main>
      <SiteFooter presentation />
    </>
  );
}
