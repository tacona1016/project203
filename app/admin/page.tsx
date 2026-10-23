import { SitePage } from "@/components/SitePage";
import { AccessForm } from "@/components/access/AccessForm";
import { AdminWorkspace } from "@/components/admin/AdminWorkspace";
import { getAdminSession, isAdminConfigured } from "@/lib/auth/admin-session";
import { requireAccessSession } from "@/lib/auth/session";

export const metadata = { title: "Admin" };
export default async function AdminPage() {
  await requireAccessSession("/admin");
  const session = await getAdminSession();
  return <SitePage label="ADMIN" title={session ? "Poll Management" : "관리자 접근"} description={session ? "투표를 만들고 운영합니다." : "투표 관리는 별도의 관리자 비밀번호가 필요합니다."}>
    {session ? <AdminWorkspace overview /> : <div className="max-w-md"><AccessForm configured={isAdminConfigured()} endpoint="/api/admin/access" returnTo="/admin" admin /></div>}
  </SitePage>;
}
