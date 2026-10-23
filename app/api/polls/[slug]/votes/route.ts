import { databaseId, handleApi, readJson, requireSameOrigin, uuid } from "@/lib/auth/http";
import { pollSlug, protectedClient } from "@/lib/site-data";
import { getPollId, submitVote } from "@/lib/supabase/queries";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handleApi(async () => {
    const client = await protectedClient();
    requireSameOrigin(request);
    const body = await readJson(request);
    const optionId = databaseId(body.optionId);
    const participantId = uuid(body.participantId);
    const id = await getPollId(client, pollSlug((await params).slug));
    return submitVote(client, id, optionId, participantId);
  });
}
