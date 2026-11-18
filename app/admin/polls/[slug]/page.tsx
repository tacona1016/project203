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
import { PollImageGallery } from "@/components/polls/PollImageGallery";

export const metadata = { title: "투표 상세 관리" };
export default async function AdminPollPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ created?: string }> }) {
  await requireAdminSession();
  const client = getSupabaseAdminClient();
  const slug = pollSlug((await params).slug);
  const data = client ? await getPoll(client, slug, true).catch((error) => { if (error instanceof HttpError && error.status === 404) notFound(); return null; }) : null;
  if (!data) return <SitePage label="ADMIN / POLLS" title="투표를 불러오지 못했습니다." description="잠시 후 다시 시도해주세요."><Link className="text-link" href="/admin/polls">투표 목록으로 돌아가기</Link></SitePage>;
  return <SitePage label="ADMIN / POLLS" title={data.poll.title} description={data.poll.description}>
    {(await searchParams).created === "1" && <p className="interaction-notice mb-5" role="status">투표를 저장했습니다. {data.attachments?.error ? "사진 상태를 불러오지 못했습니다." : `첨부 사진 ${data.attachments?.images.length ?? 0}개`}{data.poll.is_hidden ? " · 숨김 상태 유지" : " · 회원에게 공개"}</p>}
    <Link href="/admin/polls" className="text-link mb-8">← 모든 투표 관리</Link>
    <PollMeta poll={data.poll} status={data.status} />
    <PollImageGallery slug={slug} images={(data.attachments?.images ?? []).filter(image => image.option_id === null)} />
    {data.attachments?.error && <p className="form-error" role="alert">{data.attachments.error}</p>}
    {data.results && <div className="my-12 max-w-3xl">{data.poll.poll_type === "text" ? <TextResponses responses={data.responses ?? []} /> : <PollResults options={data.options} results={data.results} multiple={data.poll.vote_mode === "multiple"} images={data.attachments?.images} slug={data.poll.slug} />}<AdminPollList items={[{ ...data, results: data.results }]} /></div>}
  </SitePage>;
}
