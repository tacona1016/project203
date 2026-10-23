import Link from "next/link";
import { Arrow } from "@/components/Arrow";
import { QuarterCover } from "@/components/QuarterCover";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getSortedQuarters } from "@/data/quarters";
import { requireAccessSession } from "@/lib/auth/session";

export default async function HomePage() {
  await requireAccessSession("/");
  const quarters = getSortedQuarters();
  const current = quarters[0];
  const years = [...new Set(quarters.map((quarter) => quarter.year))].sort((a, b) => b - a);

  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="site-container">
        <section className="home-intro" aria-labelledby="site-title">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
            <p className="eyebrow text-muted">A QUARTERLY PERSPECTIVE</p>
            <span className="eyebrow hidden text-muted sm:block">EST. 2026</span>
          </div>
          <h1 id="site-title" className="home-title">203 PROJECT<span className="text-accent">.</span></h1>
          <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
            <p className="max-w-md text-base leading-8 text-muted sm:text-lg">지나온 과정을 기록하고, 앞으로의 방향을 그립니다.</p>
            <span className="eyebrow mt-1 text-muted">RECORD. REFLECT. MOVE FORWARD.</span>
          </div>
        </section>

        <section aria-labelledby="current-title" className="pb-20 sm:pb-28">
          <div className="mb-7 flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
            <h2 id="current-title" className="eyebrow">Current</h2>
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

        <section id="archive" aria-labelledby="archive-title" className="archive-section">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4 sm:mb-12">
            <div>
              <p className="eyebrow mb-3 text-muted">THE COLLECTION</p>
              <h2 id="archive-title" className="text-4xl font-medium tracking-[-0.04em] sm:text-5xl">Archive<span className="ml-3 align-top text-sm tracking-normal text-muted">{String(quarters.length).padStart(2, "0")}</span></h2>
            </div>
            <p className="text-sm text-muted">분기마다 쌓이는 우리의 기록.</p>
          </div>
          {years.map((year) => (
            <div key={year} className="archive-year">
              <h3 className="text-2xl font-medium tracking-tight">{year}</h3>
              <ul className="min-w-0">
                {quarters.filter((quarter) => quarter.year === year).map((quarter) => (
                  <li key={quarter.slug}>
                    <Link href={`/quarter/${quarter.slug}`} className="archive-link group" aria-label={`${quarter.year} Q${quarter.quarter} ${quarter.title}`}>
                      <span className="text-xl font-medium">Q{quarter.quarter}</span>
                      <span className="archive-description">
                        <span className="block text-sm font-medium sm:text-base">{quarter.title}</span>
                        <time dateTime={quarter.publishedAt} className="mt-1 block text-xs text-muted sm:hidden">{quarter.publishedAt.replaceAll("-", ".")}</time>
                      </span>
                      <time dateTime={quarter.publishedAt} className="hidden text-xs text-muted sm:block">{quarter.publishedAt.replaceAll("-", ".")}</time>
                      <Arrow direction="up-right" className="text-muted group-hover:text-accent" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
