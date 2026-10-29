import { handleApi, HttpError, requireApiSession } from "@/lib/auth/http";
import { pollSlug, protectedClient } from "@/lib/site-data";
import { getPoll, getParticipation } from "@/lib/supabase/queries";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handleApi(async () => {
    const client = await protectedClient();
    if (new URL(request.url).searchParams.size) throw new HttpError(400, "다른 회원의 참여 기록은 조회할 수 없습니다.");
    const { participantId } = await requireApiSession();
    const { poll } = await getPoll(client, pollSlug((await params).slug));
    // Both choice selections and text could otherwise reconstruct hidden outcomes.
    return getParticipation(client, poll.id, participantId);
  });
}
