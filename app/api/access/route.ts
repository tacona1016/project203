import { createAccessSession, isAccessConfigured, safeReturnTo } from "@/lib/auth/session";
import { handleApi, HttpError, readJson, requireSameOrigin } from "@/lib/auth/http";
import { passwordsMatch } from "@/lib/auth/token";

export async function POST(request: Request) {
  return handleApi(async () => {
    requireSameOrigin(request);
    const body = await readJson(request);
    if (!isAccessConfigured()) throw new HttpError(503, "지금은 입장할 수 없습니다. 잠시 후 다시 시도해주세요.");
    if (typeof body.password !== "string" || !body.password || body.password.length > 1024
      || !passwordsMatch(body.password, process.env.SITE_ACCESS_PASSWORD!)) {
      throw new HttpError(401, "비밀번호가 올바르지 않습니다.");
    }
    await createAccessSession();
    return { redirectTo: safeReturnTo(body.next) };
  });
}
