import Link from "next/link";
import { Suspense } from "react";
import { ActivePollSummary } from "@/components/polls/PollCatalog";
import { Arrow } from "@/components/Arrow";
import { QuarterCover } from "@/components/QuarterCover";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getLatestPresentation } from "@/data/quarters";
import { requireAccessSession } from "@/lib/auth/session";
import { PrivateSiteImage } from "@/components/PrivateSiteImage";
import { ProjectStatusSection, ProjectEventsSection } from "@/components/home/ManagedProject";
import { HomeBoardUpdates } from "@/components/home/LatestNotices";
import { ProjectRoadmap } from "@/components/home/ProjectRoadmap";
import { landCandidates } from "@/data/land-candidates";
import { LandComparison } from "@/components/project/LandComparison";

export default async function HomePage() {
  await requireAccessSession("/");
  const current = getLatestPresentation();

  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="site-container home-page">
        <section className="home-intro" aria-labelledby="site-title" data-home-section="intro">
          <div className="home-intro-copy">
            <p className="eyebrow text-muted">함께 만드는 장기 프로젝트 · EST. 2026</p>
            <h1 id="site-title" className="home-title">203 PROJECT<span className="text-accent">.</span></h1>
            <p className="home-description">친구들이 함께 자금을 모으고, 토지와 공간을 준비하는 장기 공동 프로젝트.</p>
          </div>
          <PrivateSiteImage image="homeHero" alt="203 PROJECT의 공간과 풍경" className="private-home-photo" />
        </section>

        <section aria-labelledby="current-title" className="home-section" data-home-section="presentation">
          <div className="home-section-heading">
            <h2 id="current-title" className="home-section-title">최신 발표자료</h2>
            <Link href="/archive" className="text-link">발표자료 전체 →</Link>
          </div>
          {current ? (
            <div className="current-feature">
              <div className="current-copy">
                <p className="text-xs text-muted"><time dateTime={current.publishedAt}>{current.publishedAt.replaceAll("-", ".")}</time> · 웹 프레젠테이션</p>
                <h3 className="current-quarter">{current.year} <span className="text-accent">Q{current.quarter}</span></h3>
                <p className="current-name">{current.title}</p>
                <p className="current-description">{current.description}</p>
                <Link href={`/quarter/${current.slug}`} className="primary-link mt-4 self-start">
                  발표자료 보기 <Arrow />
                </Link>
              </div>
              <QuarterCover year={current.year} quarter={current.quarter} />
            </div>
          ) : (
            <p className="bg-surface p-8 text-muted">첫 프레젠테이션을 준비하고 있습니다.</p>
          )}
        </section>

        <section aria-labelledby="active-polls-title" className="home-section" data-home-section="polls">
          <h2 id="active-polls-title" className="home-section-title mb-4">투표 현황</h2>
          <Suspense fallback={<p className="interaction-notice" role="status">투표를 불러오는 중...</p>}><ActivePollSummary /></Suspense>
        </section>

        <Suspense fallback={<p className="interaction-notice" role="status">프로젝트 현황을 불러오는 중...</p>}><ProjectStatusSection /></Suspense>

        <Suspense fallback={<p className="interaction-notice" role="status">공지와 결정사항을 불러오는 중...</p>}><HomeBoardUpdates /></Suspense>
        <ProjectRoadmap />
        <Suspense fallback={null}><ProjectEventsSection /></Suspense>
        {landCandidates.length > 0 && <LandComparison candidates={landCandidates} />}
      </main>
      <SiteFooter />
    </>
  );
}
