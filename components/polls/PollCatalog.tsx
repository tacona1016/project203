import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getPollCatalog } from "@/lib/supabase/queries";
import { PollCard } from "./PollCard";
import Link from "next/link";
import { getCurrentQuarter, getQuarterLabel } from "@/data/quarters";
import { getQuarterPolls } from "@/lib/polls";

export async function ActivePollSummary() {
  const client = await getSupabaseServerClient();
  const catalog = client ? await getPollCatalog(client).catch(() => null) : null;
  if (!catalog) return <p className="interaction-notice">진행 중인 투표를 불러오지 못했습니다. 잠시 후 다시 확인해주세요.</p>;
  const current = getCurrentQuarter();
  const active = current ? getQuarterPolls(catalog, current.slug).filter((item) => item.status === "ACTIVE") : [];
  const otherActive = catalog.filter((item) => item.poll.quarter !== current?.slug && item.status === "ACTIVE").length;
  return <>
    {current && <p className="eyebrow mb-4">{getQuarterLabel(current)}</p>}
    <p className="mb-6 text-muted">{active.length ? `현재 분기에 ${active.length}개의 투표가 진행 중입니다.` : "현재 분기에 진행 중인 투표가 없습니다."}</p>
    <div>{active.slice(0, 3).map((summary) => <PollCard key={summary.poll.id} summary={summary} showCounts={false} />)}</div>
    <Link href="/polls" className="text-link mt-8">View All Polls →</Link>
    {otherActive > 0 && <p className="mt-5"><Link className="text-link" href="/polls#poll-archive">다른 분기에 진행 중인 투표 {otherActive}개 →</Link></p>}
  </>;
}
