import { clearAdminSession, requireAdminApiSession } from "@/lib/auth/admin-session";
import { handleApi, requireSameOrigin } from "@/lib/auth/http";

export async function POST(request: Request) {
  return handleApi(async () => { await requireAdminApiSession(); requireSameOrigin(request); await clearAdminSession(); return { success: true }; });
}
