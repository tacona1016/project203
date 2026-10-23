import Link from "next/link";
import { SitePage } from "@/components/SitePage";
import { Poll } from "@/components/interactive/Poll";
import { pollSlug } from "@/lib/site-data";
import { findQuarter, getCurrentQuarter, getQuarterLabel } from "@/data/quarters";
import { QuarterPolls } from "@/components/polls/QuarterPolls";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getPollCatalog } from "@/lib/supabase/queries";
import { notFound } from "next/navigation";

export const metadata = { title: "Poll" };
// Keep existing /polls/<poll-slug> links while registered quarter slugs show a collection.
export default async function PollPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string }> }) {
  const slug = pollSlug((await params).slug);
  const quarter = findQuarter(slug);
  if (quarter) {
    const client = await getSupabaseServerClient();
    const catalog = client ? await getPollCatalog(client).catch(() => null) : null;
    return <SitePage label="QUARTER / POLLS" title={`${getQuarterLabel(quarter)} Polls`}>
      <Link href="/polls" className="text-link mb-10">← 모든 분기 투표</Link>
      {quarter.slug !== getCurrentQuarter()?.slug && <p className="mb-8 max-w-xl text-muted">이전 분기의 기록입니다. 투표 기간과 종료 설정에 따라 지금도 참여할 수 있습니다.</p>}
      <QuarterPolls quarter={quarter} catalog={catalog} closed={(await searchParams).tab === "closed"} href={`/polls/${quarter.slug}`} />
    </SitePage>;
  }
  if (/^\d{4}-q[1-4]$/.test(slug)) notFound();
  return <SitePage label="SHARED DECISIONS" title="투표"><Link href="/polls" className="text-link mb-12">← 모든 투표</Link><Poll pollId={slug} /></SitePage>;
}
