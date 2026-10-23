import Link from "next/link";
import { Suspense } from "react";
import { ActivePollSummary } from "@/components/polls/PollCatalog";
import { Arrow } from "@/components/Arrow";
import { QuarterCover } from "@/components/QuarterCover";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getCurrentQuarter } from "@/data/quarters";
import { requireAccessSession } from "@/lib/auth/session";
import { PrivateSiteImage } from "@/components/PrivateSiteImage";

export default async function HomePage() {
  await requireAccessSession("/");
  const current = getCurrentQuarter();

  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="site-container">
        <section className="home-intro" aria-labelledby="site-title">
          <PrivateSiteImage image="homeHero" alt="203 PROJECT의 공간과 풍경" className="private-home-photo" />
          <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
            <p className="eyebrow text-muted">A QUARTERLY PERSPECTIVE</p>
            <span className="eyebrow hidden text-muted sm:block">EST. 2026</span>
          </div>
          <h1 id="site-title" className="home-title">203 PROJECT<span className="text-accent">.</span></h1>
          <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
            <p className="max-w-md text-base leading-8 text-muted sm:text-lg">친구들이 함께 자금을 모으고, 토지와 공간을 준비하는 장기 공동 프로젝트.</p>
            <span className="eyebrow mt-1 text-muted">RECORD. REFLECT. MOVE FORWARD.</span>
          </div>
        </section>

        <section aria-labelledby="current-title" className="pb-20 sm:pb-28">
          <div className="mb-7 flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
            <h2 id="current-title" className="eyebrow">Latest Presentation</h2>
            <span className="text-xs text-muted">가장 최근의 이야기</span>
          </div>
          {current ? (
            <div className="current-feature">
              <div className="current-copy">
                <span className="quarter-badge self-start">LATEST PRESENTATION</span>
                <h3 className="current-quarter">{current.year} <span className="text-accent">Q{current.quarter}</span></h3>
                <p className="mt-3 text-xl font-medium tracking-tight sm:text-2xl">{current.title}</p>
                <p className="mt-5 max-w-sm text-sm leading-7 text-muted sm:text-base">{current.description}</p>
                <Link href={`/quarter/${current.slug}`} className="primary-link mt-9 self-start">
                  View Presentation <Arrow />
                </Link>
                <p className="mt-8 text-xs text-muted"><time dateTime={current.publishedAt}>{current.publishedAt.replaceAll("-", ".")}</time> <span className="mx-2">·</span> WEB PRESENTATION</p>
              </div>
              <QuarterCover year={current.year} quarter={current.quarter} />
            </div>
          ) : (
            <p className="bg-surface p-8 text-muted">첫 프레젠테이션을 준비하고 있습니다.</p>
          )}
        </section>

        <section aria-labelledby="active-polls-title" className="pb-24">
          <p className="eyebrow mb-4 text-accent">ACTIVE POLLS</p>
          <h2 id="active-polls-title" className="mb-8 text-3xl font-medium tracking-tight sm:text-4xl">지금 함께 정할 것들.</h2>
          <Suspense fallback={<p className="interaction-notice" role="status">투표를 불러오는 중...</p>}><ActivePollSummary /></Suspense>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
