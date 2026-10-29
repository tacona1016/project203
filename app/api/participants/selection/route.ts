import { handleApi, HttpError, requireApiSession } from "@/lib/auth/http";
export async function POST() {
  return handleApi(async () => { await requireApiSession(); throw new HttpError(410, "회원 변경은 로그아웃 후 다시 로그인해주세요."); });
}
