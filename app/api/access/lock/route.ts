import { clearAccessSession } from "@/lib/auth/session";
import { handleApi, requireApiSession, requireSameOrigin } from "@/lib/auth/http";

export async function POST(request: Request) {
  return handleApi(async () => {
    await requireApiSession();
    requireSameOrigin(request);
    await clearAccessSession();
    return { success: true };
  });
}
