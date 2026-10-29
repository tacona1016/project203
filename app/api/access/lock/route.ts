import { clearAccessSession } from "@/lib/auth/session";
import { handleApi, requireSameOrigin } from "@/lib/auth/http";

export async function POST(request: Request) {
  return handleApi(async () => {
    requireSameOrigin(request);
    await clearAccessSession();
    return { success: true };
  });
}
