import { SitePage } from "@/components/SitePage";
import { AccessForm } from "@/components/access/AccessForm";
import { AdminWorkspace } from "@/components/admin/AdminWorkspace";
import { getAdminSession, isAdminConfigured } from "@/lib/auth/admin-session";
import { requireAccessSession } from "@/lib/auth/session";

export const metadata = { title: "관리자" };
export default async function AdminPage() {
  await requireAccessSession("/admin");
  const session = await getAdminSession();
  return <SitePage label="ADMIN" title={session ? "프로젝트 관리" : "관리자 접근"} description={session ? "진행 중인 투표와 공지, 다음 운영 작업을 확인합니다." : "관리는 별도의 관리자 비밀번호가 필요합니다."}>
    {session ? <AdminWorkspace overview /> : <div className="max-w-md"><AccessForm configured={isAdminConfigured()} endpoint="/api/admin/access" returnTo="/admin" admin /></div>}
  </SitePage>;
}
