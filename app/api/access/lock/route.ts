import { clearAccessSession } from "@/lib/auth/session";
import { clearAdminSession } from "@/lib/auth/admin-session";
import { clearParticipantSelection } from "@/lib/auth/participant-session";
import { clearBoardSession } from "@/lib/auth/board-session";
import { handleApi, requireApiSession, requireSameOrigin } from "@/lib/auth/http";

export async function POST(request: Request) {
  return handleApi(async () => {
    await requireApiSession();
    requireSameOrigin(request);
    await clearAccessSession();
    await clearAdminSession();
    await clearParticipantSelection();
    await clearBoardSession();
    return { success: true };
  });
}
