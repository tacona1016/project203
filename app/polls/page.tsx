import { SitePage } from "@/components/SitePage";
import { QuarterPolls, PollQuarterArchive } from "@/components/polls/QuarterPolls";
import { getCurrentQuarter } from "@/data/quarters";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getMemberPollCatalog } from "@/lib/supabase/queries";
import { parsePollView } from "@/lib/poll-view";

export const metadata = { title: "투표" };
export default async function PollsPage({ searchParams }: { searchParams: Promise<{ status?: string; tab?: string; participation?: string }> }) {
  const query = await searchParams;
  const view = parsePollView(query);
  const client = await getSupabaseServerClient();
  const catalog = client ? await getMemberPollCatalog(client).catch(() => null) : null;
  const current = getCurrentQuarter();
  return <SitePage label="POLLS" title="투표" description="의견을 모으고 결정의 과정을 기록합니다.">
    <p className="eyebrow mb-3 text-accent">현재 분기</p>
    {current ? <QuarterPolls quarter={current} catalog={catalog} href="/polls" view={view} /> : <p className="interaction-notice">등록된 분기가 없습니다.</p>}
    <PollQuarterArchive catalog={catalog} />
  </SitePage>;
}
