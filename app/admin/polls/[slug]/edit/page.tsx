import { notFound } from "next/navigation";
import { SitePage } from "@/components/SitePage";
import { PollEditor } from "@/components/admin/PollEditor";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPoll } from "@/lib/supabase/queries";
import { pollSlug } from "@/lib/site-data";
import { HttpError } from "@/lib/auth/http";
import { getQuarterChoices } from "@/data/quarters";

export const metadata = { title: "Edit Poll" };
export default async function EditPollPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdminSession();
  const client = getSupabaseAdminClient();
  const data = client ? await getPoll(client, pollSlug((await params).slug), true).catch((error) => { if (error instanceof HttpError && error.status === 404) notFound(); return null; }) : null;
  if (!data) return <SitePage label="ADMIN / POLLS" title="투표를 불러오지 못했습니다." description="잠시 후 다시 시도해주세요."><p className="form-note">DB 연결과 migration 적용 여부를 확인해주세요.</p></SitePage>;
  return <SitePage label="ADMIN / POLLS" title="Edit Poll"><PollEditor initial={data} quarterChoices={getQuarterChoices()} /></SitePage>;
}
