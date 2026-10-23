import Link from "next/link";
import { notFound } from "next/navigation";
import { SitePage } from "@/components/SitePage";
import { PollMeta } from "@/components/polls/PollMeta";
import { PollResults } from "@/components/interactive/PollResults";
import { TextResponses } from "@/components/interactive/TextResponses";
import { AdminPollList } from "@/components/admin/AdminPollList";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPoll } from "@/lib/supabase/queries";
import { pollSlug } from "@/lib/site-data";
import { HttpError } from "@/lib/auth/http";

export const metadata = { title: "Manage Poll" };
export default async function AdminPollPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdminSession();
  const client = getSupabaseAdminClient();
  const slug = pollSlug((await params).slug);
  const data = client ? await getPoll(client, slug, true).catch((error) => { if (error instanceof HttpError && error.status === 404) notFound(); return null; }) : null;
  if (!data) return <SitePage label="ADMIN / POLLS" title="투표를 불러오지 못했습니다." description="잠시 후 다시 시도해주세요."><Link className="text-link" href="/admin/polls">투표 목록으로 돌아가기</Link></SitePage>;
  return <SitePage label="ADMIN / POLLS" title={data.poll.title} description={data.poll.description}>
    <Link href="/admin/polls" className="text-link mb-8">← 모든 투표 관리</Link>
    <PollMeta poll={data.poll} status={data.status} />
    {data.results && <div className="my-12 max-w-3xl">{data.poll.poll_type === "text" ? <TextResponses responses={data.responses ?? []} /> : <PollResults options={data.options} results={data.results} />}<AdminPollList items={[{ ...data, results: data.results }]} /></div>}
  </SitePage>;
}
