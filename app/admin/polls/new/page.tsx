import { SitePage } from "@/components/SitePage";
import { PollEditor } from "@/components/admin/PollEditor";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { getQuarterChoices } from "@/data/quarters";

export const metadata = { title: "투표 만들기" };
export default async function NewPollPage() {
  await requireAdminSession();
  return <SitePage label="ADMIN / POLLS" title="투표 만들기" description="분기와 참여 방식을 정하고 새 투표를 만듭니다."><PollEditor quarterChoices={getQuarterChoices()} /></SitePage>;
}
