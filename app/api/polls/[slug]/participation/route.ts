import { handleApi, uuid } from "@/lib/auth/http";
import { pollSlug, protectedClient } from "@/lib/site-data";
import { getPoll, getParticipation } from "@/lib/supabase/queries";
import { requireParticipantSelection } from "@/lib/auth/participant-session";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handleApi(async () => {
    const client = await protectedClient();
    const participantId = uuid(new URL(request.url).searchParams.get("participantId"));
    const { poll } = await getPoll(client, pollSlug((await params).slug));
    // Both choice selections and text could otherwise reconstruct hidden outcomes.
    await requireParticipantSelection(participantId);
    return getParticipation(client, poll.id, participantId);
  });
}
