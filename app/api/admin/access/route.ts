import { createAdminSession, isAdminConfigured } from "@/lib/auth/admin-session";
import { handleApi, HttpError, readJson, requireApiSession, requireSameOrigin } from "@/lib/auth/http";
import { passwordsMatch } from "@/lib/auth/token";

export async function POST(request: Request) {
  return handleApi(async () => {
    await requireApiSession();
    requireSameOrigin(request);
    const body = await readJson(request);
    if (!isAdminConfigured()) throw new HttpError(503, "관리자 접근 설정을 준비하고 있습니다.");
    if (typeof body.password !== "string" || !body.password || body.password.length > 1024 || !passwordsMatch(body.password, process.env.ADMIN_PASSWORD!)) {
      throw new HttpError(401, "비밀번호가 올바르지 않습니다.");
    }
    await createAdminSession();
    return { redirectTo: "/admin" };
  });
}
