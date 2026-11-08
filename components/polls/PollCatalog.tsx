import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getMemberPollCatalog } from "@/lib/supabase/queries";
import { PollCard } from "./PollCard";
import Link from "next/link";
import { getCurrentQuarter, getQuarterLabel } from "@/data/quarters";
import { getQuarterPolls } from "@/lib/polls";
import { selectHomePolls } from "@/lib/home-view";

export async function ActivePollSummary() {
  const client = await getSupabaseServerClient();
  const catalog = client ? await getMemberPollCatalog(client).catch(() => null) : null;
  if (!catalog) return <p className="interaction-notice" role="status">진행 중인 투표를 불러오지 못했습니다. 잠시 후 다시 확인해주세요.</p>;
  const current = getCurrentQuarter();
  const active = current ? getQuarterPolls(catalog, current.slug).filter((item) => item.status === "ACTIVE") : [];
  const otherActive = catalog.filter((item) => item.poll.quarter !== current?.slug && item.status === "ACTIVE").length;
  if (!active.length) return <p className="interaction-notice home-poll-links">
    <span>현재 분기에 진행 중인 투표가 없습니다.</span>
    <Link href="/polls" className="text-link">모든 투표 보기 →</Link>
    {otherActive > 0 && <Link href="/polls#poll-archive" className="text-link">다른 분기 진행 중 {otherActive}개 →</Link>}
  </p>;
  const known = active.every((item) => item.ownParticipation != null);
  const pending = active.filter((item) => item.ownParticipation?.hasParticipated === false);
  const ordered = selectHomePolls(active);
  return <>
    <div className="home-poll-summary">
      {current && <span className="eyebrow">{getQuarterLabel(current)}</span>}
      <p>진행 중 <strong>{active.length}개</strong></p>
      <p>내 미참여 <strong>{known ? `${pending.length}개` : "확인 불가"}</strong></p>
      {known && pending.length > 0 && <Link href="/polls?participation=pending" className="text-link">미참여 투표 보기 →</Link>}
    </div>
    {!known && <p className="mb-6 text-sm text-muted">내 참여 상태를 확인하지 못했습니다. 잠시 후 다시 확인해주세요.</p>}
    <div>{ordered.map((summary) => <PollCard key={summary.poll.id} summary={summary} showCounts={false} compact />)}</div>
    <div className="home-poll-links">
      <Link href="/polls" className="text-link">모든 투표 보기 →</Link>
      {otherActive > 0 && <Link className="text-link" href="/polls#poll-archive">다른 분기 진행 중 {otherActive}개 →</Link>}
    </div>
  </>;
}
