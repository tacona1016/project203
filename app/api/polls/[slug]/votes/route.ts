import { databaseId, handleApi, HttpError, readJson, requireSameOrigin, uuid } from "@/lib/auth/http";
import { pollSlug, protectedClient } from "@/lib/site-data";
import { getPoll, submitTextResponse, submitVote } from "@/lib/supabase/queries";
import { validateTextResponse } from "@/lib/polls";
import { requireParticipantSelection } from "@/lib/auth/participant-session";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handleApi(async () => {
    const client = await protectedClient();
    requireSameOrigin(request);
    // 5000 Unicode characters can require 20 KB in UTF-8.
    const body = await readJson(request, 32_768);
    const participantId = uuid(body.participantId);
    const { poll } = await getPoll(client, pollSlug((await params).slug));
    if (poll.poll_type === "text") {
      await requireParticipantSelection(participantId);
      if (body.optionId !== undefined && body.optionId !== null) throw new HttpError(400, "주관식 응답에는 선택지를 지정할 수 없습니다.");
      let text: string;
      try { text = validateTextResponse(body.textResponse, poll.text_max_length); }
      catch (error) { throw new HttpError(400, (error as Error).message); }
      return submitTextResponse(client, poll.id, participantId, text);
    }
    if (body.textResponse !== undefined && body.textResponse !== null) throw new HttpError(400, "객관식 투표에는 응답 내용을 지정할 수 없습니다.");
    return submitVote(client, poll.id, databaseId(body.optionId), participantId);
  });
}
