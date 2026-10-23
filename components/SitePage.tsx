import type { ReactNode } from "react";
import { requireAccessSession } from "@/lib/auth/session";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

export async function SitePage({ label, title, description, children, beforeHeading }: { label: string; title: string; description?: string; children: ReactNode; beforeHeading?: ReactNode }) {
  await requireAccessSession();
  return <><SiteHeader /><main id="main-content" tabIndex={-1} className="site-container content-page">
    {beforeHeading}
    <header className="page-heading"><p className="eyebrow text-accent">{label}</p><h1>{title}</h1>{description && <p className="mt-5 max-w-2xl text-muted">{description}</p>}</header>
    {children}
  </main><SiteFooter /></>;
}
