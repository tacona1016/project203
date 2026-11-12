import Link from "next/link";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPollCatalog } from "@/lib/supabase/queries";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { AdminPollList } from "./AdminPollList";
import { LockSiteButton } from "@/components/access/LockSiteButton";
import { findQuarter, getCurrentQuarter, getQuarterLabel, getSortedQuarters } from "@/data/quarters";
import { formatKoreanDate, getPollCounts, getQuarterPolls, POLL_STATUS_LABELS } from "@/lib/polls";
import type { PollStatus } from "@/lib/supabase/types";

export async function AdminWorkspace({ overview = false, quarter: requestedQuarter, status: requestedStatus }: { overview?: boolean; quarter?: string; status?: string }) {
  await requireAdminSession();
  const client = getSupabaseAdminClient();
  const catalog = client ? await getPollCatalog(client, true).catch(() => null) : null;
  const current = getCurrentQuarter();
  const selected = requestedQuarter === "all" ? "all" : findQuarter(requestedQuarter ?? "")?.slug ?? current?.slug ?? "all";
  const status = requestedStatus && Object.hasOwn(POLL_STATUS_LABELS, requestedStatus) ? requestedStatus as PollStatus : "all";
  const quarterItems = selected === "all" ? catalog ?? [] : getQuarterPolls(catalog ?? [], selected);
  const filtered = status === "all" ? quarterItems : quarterItems.filter((item) => item.status === status);
  const counts = getPollCounts(quarterItems);
  const totals = getPollCounts(catalog ?? []);
  const closingSoon = (catalog ?? []).filter(item => item.status === "ACTIVE" && item.poll.voting_ends_at
    && Date.parse(item.poll.voting_ends_at) > Date.parse(item.server_time)
    && Date.parse(item.poll.voting_ends_at) - Date.parse(item.server_time) <= 7 * 86400000)
    .sort((a, b) => a.poll.voting_ends_at!.localeCompare(b.poll.voting_ends_at!));
  return <>
    {overview && <nav className="project-admin-links" aria-label="운영 관리"><Link href="/admin/project" className="secondary-link">현황·일정·결정 관리 →</Link><Link href="/admin/polls" className="text-link">투표 관리 →</Link></nav>}
    <div className="admin-workspace-actions"><div className="flex flex-wrap items-center gap-3"><Link href="/admin/polls/new" className="interaction-button">+ 투표 만들기</Link><Link href="/board/new?type=notice" className="secondary-link">공지 작성</Link>{overview && <Link className="text-link" href="/admin/polls">모든 투표 관리 →</Link>}</div><LockSiteButton admin /></div>
    {overview && catalog && <section aria-label="관리자 현황" className="mb-6">
      <h2 className="eyebrow text-accent">운영 현황</h2>
      <dl className="admin-stats admin-dashboard-stats">
        {[['전체 투표', totals.total], ['진행 중', totals.active], ['예정', totals.upcoming], ['종료', totals.closed], ['숨김', totals.hidden], ['7일 내 마감', closingSoon.length]].map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{count}</dd></div>)}
      </dl>
      <div className="flex flex-wrap gap-x-5 gap-y-2"><Link href="/board#board-notices" className="text-link">고정 공지 확인 →</Link><Link href="/board" className="text-link">게시판 관리 →</Link></div>
      {!!closingSoon.length && <div className="mt-4"><h3 className="mb-2 font-medium">7일 이내 마감하는 투표</h3><ul className="grid gap-2">{closingSoon.slice(0, 3).map(item => <li key={item.poll.id} className="flex flex-wrap justify-between gap-3"><Link href={`/admin/polls/${item.poll.slug}`} className="text-link">{item.poll.title}</Link><time className="text-sm text-muted" dateTime={item.poll.voting_ends_at!}>{formatKoreanDate(item.poll.voting_ends_at!)} 마감</time></li>)}</ul></div>}
    </section>}
    {!catalog ? <p className="interaction-notice" role="alert">관리할 투표를 불러오지 못했습니다. DB 연결과 migration 적용 여부를 확인해주세요.</p> : <>
      <nav aria-label="관리할 분기" className="admin-quarter-nav">
        {getSortedQuarters().map((quarter) => <Link key={quarter.slug} href={`/admin/polls?quarter=${quarter.slug}`} className="text-link">{getQuarterLabel(quarter)} · 투표 {getQuarterPolls(catalog, quarter.slug).length}개</Link>)}
      </nav>
      <form key={`${selected}-${status}`} action="/admin/polls" className="admin-form admin-filters mb-6">
        <div><label htmlFor="filter-quarter">분기</label><select id="filter-quarter" name="quarter" defaultValue={selected}>
          <option value="all">전체 분기</option>{getSortedQuarters().map((quarter) => <option key={quarter.slug} value={quarter.slug}>{getQuarterLabel(quarter)}</option>)}
        </select></div>
        <div><label htmlFor="filter-status">상태</label><select id="filter-status" name="status" defaultValue={status}>
          <option value="all">전체 상태</option>{Object.entries(POLL_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></div>
        <button type="submit" className="interaction-button self-end">적용</button>
      </form>
      <h2 className="text-2xl font-medium">{selected === "all" ? "전체 분기" : getQuarterLabel(findQuarter(selected)!)}</h2>
      <p className="form-note mt-3 mb-4">전체 {counts.total}개 · 진행 중 {counts.active}개 · 예정 {counts.upcoming}개 · 종료 {counts.closed}개 · 숨김 {counts.hidden}개</p>
      <AdminPollList items={overview ? filtered.slice(0, 5) : filtered} />
    </>}
  </>;
}
