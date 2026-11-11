import { SitePage } from "@/components/SitePage";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { getProjectAdmin } from "@/lib/project/data";
import { ProjectAdmin } from "@/components/admin/ProjectAdmin";

export const metadata = { title: "프로젝트 운영 관리" };
export default async function ProjectAdminPage() {
  await requireAdminSession();
  let state;
  try { state = await getProjectAdmin(); }
  catch { return <SitePage label="ADMIN" title="프로젝트 운영 관리"><p className="interaction-notice" role="alert">운영 정보를 불러오지 못했습니다. 잠시 후 새로고침해주세요.</p></SitePage>; }
  return <SitePage label="ADMIN" title="프로젝트 운영 관리" description="합의된 현황·일정·결정 공지를 관리합니다. 변경 이력은 보존됩니다."><ProjectAdmin initial={state} /></SitePage>;
}
