import { getBoardViewer } from "@/lib/auth/board-session";
import { handleApi, HttpError, requireApiSession } from "@/lib/auth/http";
export async function GET() { return handleApi(getBoardViewer); }
// Old clients cannot convert a board or freely selected name into a member login.
export async function POST() {
  return handleApi(async () => { await requireApiSession(); throw new HttpError(410, "게시판 추가 인증은 종료되었습니다. 회원 로그인을 이용해주세요."); });
}
