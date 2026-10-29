import { createAccessSession, safeReturnTo } from "@/lib/auth/session";
import { handleApi, HttpError, readJson, requireSameOrigin } from "@/lib/auth/http";
import { authenticateMember } from "@/lib/auth/members";

export async function POST(request: Request) {
  return handleApi(async () => {
    requireSameOrigin(request);
    const body = await readJson(request);
    const member = await authenticateMember(body.participantId, body.password);
    if (!member) throw new HttpError(401, "이름과 비밀번호를 확인해주세요.");
    await createAccessSession(member.id);
    return { redirectTo: safeReturnTo(body.next) };
  });
}
