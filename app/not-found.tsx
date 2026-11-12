import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Arrow } from "@/components/Arrow";
import { getAccessSession } from "@/lib/auth/session";
import { AuthServiceError } from "@/lib/auth/service-error";
import { ServiceUnavailable } from "@/components/access/ServiceUnavailable";

export default async function NotFound() {
  let session;
  try { session = await getAccessSession(); }
  catch (error) { if (error instanceof AuthServiceError) return <ServiceUnavailable />; throw error; }
  return (
    <>
      {session ? <SiteHeader /> : <header className="site-header"><div className="site-container py-5"><Link href="/access" className="wordmark">203 PROJECT</Link></div></header>}
      <main id="main-content" tabIndex={-1} className="site-container flex min-h-[65svh] flex-col items-start justify-center py-20">
        <p className="eyebrow mb-6 text-accent">404 / PAGE NOT FOUND</p>
        <h1 className="section-title">아직 없는 기록입니다.</h1>
        <p className="mt-6 text-muted">주소를 확인하거나, 등록된 프레젠테이션을 살펴보세요.</p>
        <Link href={session ? "/" : "/access"} className="primary-link mt-9">{session ? "홈으로 돌아가기" : "로그인하기"} <Arrow /></Link>
      </main>
      <SiteFooter />
    </>
  );
}
