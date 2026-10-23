import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAccessSession, isAccessConfigured, safeReturnTo } from "@/lib/auth/session";
import { AccessForm } from "@/components/access/AccessForm";

export const metadata: Metadata = { title: "Private Access", robots: { index: false, follow: false } };

export default async function AccessPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const returnTo = safeReturnTo((await searchParams).next);
  if (await getAccessSession()) redirect(returnTo);
  return (
    <main id="main-content" className="access-page">
      <div className="access-content">
        <p className="wordmark"><span className="brand-mark" aria-hidden="true"><span /></span>203 PROJECT</p>
        <p className="eyebrow mt-16 text-accent">PRIVATE ACCESS</p>
        <h1 className="mt-5 text-4xl font-medium tracking-tight sm:text-5xl">우리의 공간으로.</h1>
        <p className="mt-5 text-muted">친구들만 사용하는 공간입니다.</p>
        <AccessForm returnTo={returnTo} configured={isAccessConfigured()} />
      </div>
    </main>
  );
}
