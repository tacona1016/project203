import { configuredBoardPassword } from "@/lib/auth/board-token";
import { createBoardSession, getBoardViewer } from "@/lib/auth/board-session";
import { getSelectedParticipantId } from "@/lib/auth/participant-session";
import { handleApi, HttpError, readJson, requireApiSession, requireSameOrigin } from "@/lib/auth/http";
import { passwordsMatch } from "@/lib/auth/token";
import { protectedClient } from "@/lib/site-data";
import { getActiveParticipant } from "@/lib/supabase/queries";

export async function GET() { return handleApi(getBoardViewer); }
export async function POST(request: Request) {
  return handleApi(async () => {
    await requireApiSession(); requireSameOrigin(request);
    const body = await readJson(request);
    if (Object.keys(body).some((key) => key !== "password")) throw new HttpError(400, "입력 내용을 확인해주세요.");
    const participantId = await getSelectedParticipantId();
    const expected = participantId ? configuredBoardPassword(process.env.BOARD_PARTICIPANT_PASSWORDS, participantId) : null;
    if (!participantId || !expected || typeof body.password !== "string" || body.password.length > 1024 || !passwordsMatch(body.password, expected)
      || !await getActiveParticipant(await protectedClient(), participantId)) throw new HttpError(403, "이름과 게시판 개인 비밀번호를 확인해주세요.");
    await createBoardSession(participantId, expected);
    return getBoardViewer();
  });
}
