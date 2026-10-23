import Link from "next/link";
import type { Quarter } from "@/data/quarters";
import { getArchivedQuarters, getQuarterLabel } from "@/data/quarters";
import { getPollCounts, getQuarterPolls } from "@/lib/polls";
import type { PollSummary } from "@/lib/supabase/types";
import { PollCard } from "./PollCard";

export function QuarterPolls({ quarter, catalog, closed, href }: { quarter: Quarter; catalog: PollSummary[] | null; closed: boolean; href: string }) {
  const items = getQuarterPolls(catalog ?? [], quarter.slug);
  const ongoing = items.filter((item) => item.status === "ACTIVE" || item.status === "UPCOMING");
  const ended = items.filter((item) => item.status === "CLOSED");
  const visible = closed ? ended : ongoing;
  return <section aria-label={`${getQuarterLabel(quarter)} 투표`}>
    <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
      <h2 className="text-3xl font-medium tracking-tight sm:text-4xl">{getQuarterLabel(quarter)}</h2>
      <span className="text-sm text-muted">{catalog ? `${items.length} Polls` : "— Polls"}</span>
    </div>
    <nav className="segmented-nav" aria-label="투표 상태">
      <Link href={href} aria-current={!closed ? "page" : undefined}>진행 중 {catalog ? ongoing.length : "—"}</Link>
      <Link href={`${href}?tab=closed`} aria-current={closed ? "page" : undefined}>종료됨 {catalog ? ended.length : "—"}</Link>
    </nav>
    {!catalog ? <p className="interaction-notice" role="alert">투표를 불러오지 못했습니다. 잠시 후 새로고침해주세요.</p>
      : !items.length ? <p className="interaction-notice">아직 등록된 투표가 없습니다.</p>
        : visible.length ? visible.map((summary) => <PollCard key={summary.poll.id} summary={summary} />)
          : <p className="interaction-notice">{closed ? "종료된 투표가 없습니다." : "진행 중이거나 예정된 투표가 없습니다."}</p>}
  </section>;
}

export function PollQuarterArchive({ catalog }: { catalog: PollSummary[] | null }) {
  const archived = getArchivedQuarters();
  return <section id="poll-archive" className="mt-24 scroll-mt-28" aria-labelledby="poll-archive-title">
    <h2 id="poll-archive-title" className="eyebrow mb-8 text-accent">POLL ARCHIVE</h2>
    {!archived.length ? <p className="text-muted">이전 분기의 투표 기록이 아직 없습니다.</p>
      : <ul>{archived.map((quarter) => {
        const counts = getPollCounts(getQuarterPolls(catalog ?? [], quarter.slug));
        return <li key={quarter.slug} className="border-t border-line py-8">
          <Link href={`/polls/${quarter.slug}`} className="flex flex-wrap items-center justify-between gap-5">
            <span><span className="block text-2xl font-medium">{getQuarterLabel(quarter)}</span>
              <span className="mt-3 block text-sm text-muted">{catalog ? `${counts.total} Polls · ${counts.active} Active · ${counts.upcoming} Upcoming · ${counts.closed} Closed` : "투표 수를 불러오지 못했습니다."}</span></span>
            <span className="text-link">View Polls →</span>
          </Link>
        </li>;
      })}</ul>}
  </section>;
}
