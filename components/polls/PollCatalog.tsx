import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getMemberPollCatalog } from "@/lib/supabase/queries";
import { PollCard } from "./PollCard";
import Link from "next/link";
import { getCurrentQuarter, getQuarterLabel } from "@/data/quarters";
import { getQuarterPolls } from "@/lib/polls";
import { formatKoreanDate } from "@/lib/polls";

export async function ActivePollSummary() {
  const client = await getSupabaseServerClient();
  const catalog = client ? await getMemberPollCatalog(client).catch(() => null) : null;
  if (!catalog) return <p className="interaction-notice">진행 중인 투표를 불러오지 못했습니다. 잠시 후 다시 확인해주세요.</p>;
  const current = getCurrentQuarter();
  const active = current ? getQuarterPolls(catalog, current.slug).filter((item) => item.status === "ACTIVE") : [];
  const otherActive = catalog.filter((item) => item.poll.quarter !== current?.slug && item.status === "ACTIVE").length;
  const known = active.every((item) => item.ownParticipation != null);
  const pending = active.filter((item) => item.ownParticipation?.hasParticipated === false);
  const ordered = [...pending, ...active.filter((item) => item.ownParticipation?.hasParticipated !== false)];
  const recent = current ? getQuarterPolls(catalog, current.slug).sort((a, b) => b.poll.created_at.localeCompare(a.poll.created_at)).slice(0, 2) : [];
  const deadlines = active.filter(item => item.poll.voting_ends_at
    && new Date(item.poll.voting_ends_at).getTime() - new Date(item.server_time).getTime() <= 7 * 86400000)
    .sort((a, b) => a.poll.voting_ends_at!.localeCompare(b.poll.voting_ends_at!)).slice(0, 3);
  return <>
    {current && <p className="eyebrow mb-4">{getQuarterLabel(current)}</p>}
    <div className="home-poll-summary">
      <p>진행 중 <strong>{active.length}개</strong></p>
      <p>내 미참여 <strong>{known ? `${pending.length}개` : "확인 불가"}</strong></p>
      {known && pending.length > 0 && <Link href="/polls?participation=pending" className="text-link">미참여 투표 보기 →</Link>}
    </div>
    {!known && <p className="mb-6 text-sm text-muted">내 참여 상태를 확인하지 못했습니다. 잠시 후 다시 확인해주세요.</p>}
    {!active.length && <p className="mb-6 text-muted">현재 분기에 진행 중인 투표가 없습니다.</p>}
    <div>{ordered.slice(0, 3).map((summary) => <PollCard key={summary.poll.id} summary={summary} showCounts={false} />)}</div>
    <div className="home-poll-priorities">
      <section aria-labelledby="home-poll-deadline-title"><h3 id="home-poll-deadline-title" className="text-sm font-medium">마감이 가까운 투표 <span className="text-xs text-muted">· 7일 이내</span></h3>
        {deadlines.length ? <ul className="mt-4 grid gap-4">{deadlines.map(item => <li key={item.poll.id}><Link className="text-link" href={`/polls/${item.poll.slug}`}>{item.poll.title} →</Link><p className="form-note mt-1">{formatKoreanDate(item.poll.voting_ends_at!)} 마감</p></li>)}</ul> : <p className="form-note mt-4">7일 이내 마감하는 진행 중 투표가 없습니다.</p>}
      </section>
      <section aria-labelledby="home-recent-polls-title"><h3 id="home-recent-polls-title" className="text-sm font-medium">최근 등록된 투표</h3>
        {recent.length ? <ul className="mt-4 grid gap-4">{recent.map(item => <li key={item.poll.id}><Link className="text-link" href={`/polls/${item.poll.slug}`}>{item.poll.title} →</Link><p className="form-note mt-1">{formatKoreanDate(item.poll.created_at)} 등록</p></li>)}</ul> : <p className="form-note mt-4">새 투표가 등록되면 이곳에 표시합니다.</p>}
      </section>
    </div>
    <Link href="/polls" className="text-link mt-8">모든 투표 보기 →</Link>
    {otherActive > 0 && <p className="mt-5"><Link className="text-link" href="/polls#poll-archive">다른 분기에 진행 중인 투표 {otherActive}개 →</Link></p>}
  </>;
}
