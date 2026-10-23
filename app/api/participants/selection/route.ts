import { handleApi, HttpError, readJson, requireSameOrigin, uuid } from "@/lib/auth/http";
import { setParticipantSelection } from "@/lib/auth/participant-session";
import { protectedClient } from "@/lib/site-data";
import { getActiveParticipant } from "@/lib/supabase/queries";

export async function POST(request: Request) {
  return handleApi(async () => {
    const client = await protectedClient();
    requireSameOrigin(request);
    const participant = await getActiveParticipant(client, uuid((await readJson(request)).participantId));
    if (!participant) throw new HttpError(400, "현재 선택할 수 없는 이름입니다.");
    await setParticipantSelection(participant.id);
    return participant;
  });
}
