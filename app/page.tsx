import Link from "next/link";
import { Suspense } from "react";
import { ActivePollSummary } from "@/components/polls/PollCatalog";
import { Arrow } from "@/components/Arrow";
import { QuarterCover } from "@/components/QuarterCover";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getLatestPresentation } from "@/data/quarters";
import { projectStatus } from "@/data/project-status";
import { requireAccessSession } from "@/lib/auth/session";
import { PrivateSiteImage } from "@/components/PrivateSiteImage";
import { ProjectTasks } from "@/components/home/ProjectTasks";
import { LatestNotices } from "@/components/home/LatestNotices";
import { ProjectRoadmap } from "@/components/home/ProjectRoadmap";
import { UpcomingEvents } from "@/components/home/UpcomingEvents";
import { landCandidates } from "@/data/land-candidates";
import { LandComparison } from "@/components/project/LandComparison";

export default async function HomePage() {
  await requireAccessSession("/");
  const current = getLatestPresentation();

  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="site-container">
        <section className="home-intro" aria-labelledby="site-title">
          <PrivateSiteImage image="homeHero" alt="203 PROJECT의 공간과 풍경" className="private-home-photo" />
          <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
            <p className="eyebrow text-muted">함께 만드는 장기 프로젝트</p>
            <span className="eyebrow hidden text-muted sm:block">EST. 2026</span>
          </div>
          <h1 id="site-title" className="home-title">203 PROJECT<span className="text-accent">.</span></h1>
          <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
            <p className="max-w-md text-base leading-8 text-muted sm:text-lg">친구들이 함께 자금을 모으고, 토지와 공간을 준비하는 장기 공동 프로젝트.</p>
            <span className="eyebrow mt-1 text-muted">기록하고, 논의하고, 한 걸음씩.</span>
          </div>
        </section>

        <section aria-labelledby="project-status-title" className="mb-16 bg-surface px-6 py-7 sm:px-8">
          <h2 id="project-status-title" className="eyebrow text-accent">프로젝트 현황</h2>
          <dl className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0"><dt className="text-xs text-muted">현재 단계</dt><dd className="mt-2 wrap-anywhere">{projectStatus?.phase ?? "미정"}</dd></div>
            <div className="min-w-0"><dt className="text-xs text-muted">진행 목표</dt><dd className="mt-2 wrap-anywhere">{projectStatus?.goal ?? "미정"}</dd></div>
            <div className="min-w-0"><dt className="text-xs text-muted">다음 행동</dt><dd className="mt-2 wrap-anywhere">{projectStatus?.nextAction ?? "미정"}</dd></div>
            <div className="min-w-0"><dt className="text-xs text-muted">기준일</dt><dd className="mt-2">{projectStatus ? <time dateTime={projectStatus.updatedAt}>{projectStatus.updatedAt.replaceAll("-", ".")}</time> : "미정"}</dd></div>
          </dl>
          {!projectStatus && <p className="mt-4 text-sm leading-7 text-muted">현재 단계와 다음 행동은 논의 후 업데이트합니다.</p>}
        </section>

        <ProjectTasks />

        <section aria-labelledby="active-polls-title" className="pb-20 sm:pb-28">
          <p className="eyebrow mb-4 text-accent">투표 현황</p>
          <h2 id="active-polls-title" className="mb-8 text-3xl font-medium tracking-tight sm:text-4xl">지금 함께 정할 것들.</h2>
          <Suspense fallback={<p className="interaction-notice" role="status">투표를 불러오는 중...</p>}><ActivePollSummary /></Suspense>
        </section>

        <section aria-labelledby="latest-notices-title" className="pb-20 sm:pb-28">
          <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
            <div><p className="eyebrow text-accent">최신 공지</p><h2 id="latest-notices-title" className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl">함께 확인할 기록.</h2></div>
            <Link href="/board" className="text-link">게시판 전체 보기 →</Link>
          </div>
          <Suspense fallback={<p className="interaction-notice" role="status">공지를 불러오는 중...</p>}><LatestNotices /></Suspense>
        </section>

        <section aria-labelledby="current-title" className="pb-20 sm:pb-28">
          <div className="mb-7 flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
            <h2 id="current-title" className="eyebrow">최신 발표자료</h2>
            <span className="text-xs text-muted">가장 최근의 이야기</span>
          </div>
          {current ? (
            <div className="current-feature">
              <div className="current-copy">
                <span className="quarter-badge self-start">최근 발표</span>
                <h3 className="current-quarter">{current.year} <span className="text-accent">Q{current.quarter}</span></h3>
                <p className="mt-3 text-xl font-medium tracking-tight sm:text-2xl">{current.title}</p>
                <p className="mt-5 max-w-sm text-sm leading-7 text-muted sm:text-base">{current.description}</p>
                <Link href={`/quarter/${current.slug}`} className="primary-link mt-9 self-start">
                  발표자료 보기 <Arrow />
                </Link>
                <p className="mt-8 text-xs text-muted"><time dateTime={current.publishedAt}>{current.publishedAt.replaceAll("-", ".")}</time> <span className="mx-2">·</span> 웹 프레젠테이션</p>
              </div>
              <QuarterCover year={current.year} quarter={current.quarter} />
            </div>
          ) : (
            <p className="bg-surface p-8 text-muted">첫 프레젠테이션을 준비하고 있습니다.</p>
          )}
        </section>
        <ProjectRoadmap />
        <UpcomingEvents />
        {landCandidates.length > 0 && <LandComparison candidates={landCandidates} />}
      </main>
      <SiteFooter />
    </>
  );
}
