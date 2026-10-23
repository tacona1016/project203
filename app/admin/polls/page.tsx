import { SitePage } from "@/components/SitePage";
import { AdminWorkspace } from "@/components/admin/AdminWorkspace";

export const metadata = { title: "Poll Management" };
export default async function AdminPollsPage({ searchParams }: { searchParams: Promise<{ quarter?: string; status?: string }> }) {
  const filters = await searchParams;
  return <SitePage label="ADMIN / POLLS" title="Poll Management"><AdminWorkspace quarter={filters.quarter} status={filters.status} /></SitePage>;
}
