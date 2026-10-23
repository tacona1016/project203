import { SitePage } from "@/components/SitePage";
import { PollEditor } from "@/components/admin/PollEditor";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { getQuarterChoices } from "@/data/quarters";

export const metadata = { title: "Create Poll" };
export default async function NewPollPage() {
  await requireAdminSession();
  return <SitePage label="ADMIN / POLLS" title="Create Poll" description="일상적인 투표는 이 화면에서 생성합니다."><PollEditor quarterChoices={getQuarterChoices()} /></SitePage>;
}
