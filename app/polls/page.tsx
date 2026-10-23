import { SitePage } from "@/components/SitePage";
import { QuarterPolls, PollQuarterArchive } from "@/components/polls/QuarterPolls";
import { getCurrentQuarter } from "@/data/quarters";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getPollCatalog } from "@/lib/supabase/queries";

export const metadata = { title: "Polls" };
export default async function PollsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const closed = (await searchParams).tab === "closed";
  const client = await getSupabaseServerClient();
  const catalog = client ? await getPollCatalog(client).catch(() => null) : null;
  const current = getCurrentQuarter();
  return <SitePage label="SHARED DECISIONS" title="Polls" description="분기별로 의견을 모으고, 결정의 과정을 기록합니다.">
    <p className="eyebrow mb-5 text-accent">CURRENT QUARTER</p>
    {current ? <QuarterPolls quarter={current} catalog={catalog} closed={closed} href="/polls" /> : <p className="interaction-notice">등록된 분기가 없습니다.</p>}
    <PollQuarterArchive catalog={catalog} />
  </SitePage>;
}
