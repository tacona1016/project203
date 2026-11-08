import Link from "next/link";
import type { Quarter } from "@/data/quarters";
import { getArchivedQuarters, getQuarterLabel } from "@/data/quarters";
import { getPollCounts, getQuarterPolls } from "@/lib/polls";
import type { PollSummary } from "@/lib/supabase/types";
import { PollCard } from "./PollCard";
import { matchesPollView, pollViewHref, type PollView } from "@/lib/poll-view";

export function QuarterPolls({ quarter, catalog, href, view }: { quarter: Quarter; catalog: PollSummary[] | null; href: string; view: PollView }) {
  const items = getQuarterPolls(catalog ?? [], quarter.slug);
  const visible = items.filter(item => matchesPollView(item, view));
  const statusChoices = [{ value: "all", label: "전체" }, { value: "active", label: "진행 중" }, { value: "upcoming", label: "예정" }, { value: "closed", label: "종료" }] as const;
  const participationChoices = [{ value: "all", label: "전체" }, { value: "pending", label: "미참여" }, { value: "done", label: "참여 완료" }] as const;
  return <section aria-label={`${getQuarterLabel(quarter)} 투표`}>
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
      <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">{getQuarterLabel(quarter)}</h2>
      <span className="text-sm text-muted">{catalog ? `전체 ${items.length}개 · 표시 ${visible.length}개` : "투표 조회 중"}</span>
    </div>
    <div className="poll-filters"><nav className="segmented-nav" aria-label="투표 상태">
      {statusChoices.map(choice => <Link key={choice.value} href={pollViewHref(href, { ...view, status: choice.value })} aria-current={view.status === choice.value ? "page" : undefined}>
        {choice.label} {catalog ? items.filter(item => matchesPollView(item, { status: choice.value, participation: "all" })).length : "—"}
      </Link>)}
    </nav>
    <nav className="poll-participation-filters" aria-label="내 참여 상태"><span className="text-sm text-muted">내 참여</span>
      {participationChoices.map(choice => <Link key={choice.value} href={pollViewHref(href, { ...view, participation: choice.value })} aria-current={view.participation === choice.value ? "page" : undefined}>{choice.label}</Link>)}
    </nav></div>
    {view.participation !== "all" && items.some((item) => item.ownParticipation == null) && <p className="interaction-notice" role="status">일부 참여 상태를 확인하지 못했습니다. 확인된 참여 기록만 필터에 표시합니다.</p>}
    {!catalog ? <p className="interaction-notice" role="alert">투표를 불러오지 못했습니다. 잠시 후 새로고침해주세요.</p>
      : !items.length ? <p className="interaction-notice">아직 등록된 투표가 없습니다.</p>
        : visible.length ? visible.map((summary) => <PollCard key={summary.poll.id} summary={summary} />)
          : <div className="interaction-notice"><p>선택한 조건에 해당하는 투표가 없습니다.</p><Link href={pollViewHref(href, { status: "all", participation: "all" })} className="text-link mt-4">이 분기의 전체 투표 보기 →</Link></div>}
  </section>;
}

export function PollQuarterArchive({ catalog }: { catalog: PollSummary[] | null }) {
  const archived = getArchivedQuarters();
  return <section id="poll-archive" className="mt-12 scroll-mt-28" aria-labelledby="poll-archive-title">
    <h2 id="poll-archive-title" className="eyebrow mb-4 text-accent">이전 분기 투표</h2>
    {!archived.length ? <p className="text-muted">이전 분기의 투표 기록이 아직 없습니다.</p>
      : <ul>{archived.map((quarter) => {
        const counts = getPollCounts(getQuarterPolls(catalog ?? [], quarter.slug));
        return <li key={quarter.slug} className="border-t border-line py-4">
          <Link href={`/polls/${quarter.slug}`} className="flex flex-wrap items-center justify-between gap-5">
            <span><span className="block text-2xl font-medium">{getQuarterLabel(quarter)}</span>
              <span className="mt-3 block text-sm text-muted">{catalog ? `${counts.total}개 · 진행 중 ${counts.active} · 예정 ${counts.upcoming} · 종료 ${counts.closed}` : "투표 수를 불러오지 못했습니다."}</span></span>
            <span className="text-link">분기 투표 보기 →</span>
          </Link>
        </li>;
      })}</ul>}
  </section>;
}
