import Link from "next/link";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPollCatalog } from "@/lib/supabase/queries";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { AdminPollList } from "./AdminPollList";
import { LockSiteButton } from "@/components/access/LockSiteButton";
import { findQuarter, getCurrentQuarter, getQuarterLabel, getSortedQuarters } from "@/data/quarters";
import { getPollCounts, getQuarterPolls, POLL_STATUS_LABELS } from "@/lib/polls";
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
  return <>
    <div className="mb-10 flex flex-wrap items-center justify-between gap-5"><div className="flex flex-wrap gap-6"><Link href="/admin/polls/new" className="interaction-button">+ Create Poll</Link>{overview && <Link className="text-link" href="/admin/polls">모든 투표 관리 →</Link>}</div><LockSiteButton admin /></div>
    {!catalog ? <p className="interaction-notice" role="alert">관리할 투표를 불러오지 못했습니다. DB 연결과 migration 적용 여부를 확인해주세요.</p> : <>
      <nav aria-label="관리할 분기" className="mb-10 flex flex-wrap gap-x-6 gap-y-4">
        {getSortedQuarters().map((quarter) => <Link key={quarter.slug} href={`/admin/polls?quarter=${quarter.slug}`} className="text-link">{getQuarterLabel(quarter)} · {getQuarterPolls(catalog, quarter.slug).length} Polls</Link>)}
      </nav>
      <form key={`${selected}-${status}`} action="/admin/polls" className="admin-form admin-filters mb-10">
        <div><label htmlFor="filter-quarter">Quarter</label><select id="filter-quarter" name="quarter" defaultValue={selected}>
          <option value="all">전체 분기</option>{getSortedQuarters().map((quarter) => <option key={quarter.slug} value={quarter.slug}>{getQuarterLabel(quarter)}</option>)}
        </select></div>
        <div><label htmlFor="filter-status">Status</label><select id="filter-status" name="status" defaultValue={status}>
          <option value="all">전체 상태</option>{Object.entries(POLL_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></div>
        <button type="submit" className="interaction-button self-end">적용</button>
      </form>
      <h2 className="text-2xl font-medium">{selected === "all" ? "전체 분기" : getQuarterLabel(findQuarter(selected)!)}</h2>
      <p className="form-note mt-4 mb-8">{counts.total} Polls · {counts.active} Active · {counts.upcoming} Upcoming · {counts.closed} Closed · {counts.hidden} Hidden</p>
      <AdminPollList items={overview ? filtered.slice(0, 5) : filtered} />
    </>}
  </>;
}
