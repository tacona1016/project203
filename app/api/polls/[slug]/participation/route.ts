import { handleApi, uuid } from "@/lib/auth/http";
import { pollSlug, protectedClient } from "@/lib/site-data";
import { getPollId, hasVoted } from "@/lib/supabase/queries";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handleApi(async () => {
    const client = await protectedClient();
    const participantId = uuid(new URL(request.url).searchParams.get("participantId"));
    const id = await getPollId(client, pollSlug((await params).slug));
    return hasVoted(client, id, participantId);
  });
}
