import { databaseId, handleApi, HttpError, readJson, requireSameOrigin, requireApiSession } from "@/lib/auth/http";
import { pollSlug, protectedClient } from "@/lib/site-data";
import { getPoll, submitTextResponse, submitVote } from "@/lib/supabase/queries";
import { validateTextResponse } from "@/lib/polls";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handleApi(async () => {
    const client = await protectedClient();
    requireSameOrigin(request);
    // 5000 Unicode characters can require 20 KB in UTF-8.
    const body = await readJson(request, 32_768);
    if (Object.keys(body).some((key) => !["optionId", "optionIds", "textResponse"].includes(key))) throw new HttpError(400, "허용되지 않은 입력입니다.");
    const { participantId } = await requireApiSession();
    const { poll } = await getPoll(client, pollSlug((await params).slug));
    if (poll.poll_type === "text") {
      if ("optionId" in body || "optionIds" in body) throw new HttpError(400, "주관식 응답에는 선택지를 지정할 수 없습니다.");
      let text: string;
      try { text = validateTextResponse(body.textResponse, poll.text_max_length); }
      catch (error) { throw new HttpError(400, (error as Error).message); }
      return submitTextResponse(client, poll.id, participantId, text);
    }
    if (body.textResponse !== undefined && body.textResponse !== null) throw new HttpError(400, "객관식 투표에는 응답 내용을 지정할 수 없습니다.");
    if ("optionId" in body && "optionIds" in body) throw new HttpError(400, "선택지 입력 방식을 확인해주세요.");
    // Only the original single-choice request remains compatible. Old multiple
    // clients cannot append another vote by repeatedly sending one optionId.
    const submitted = "optionIds" in body ? body.optionIds
      : poll.vote_mode === "single" && "optionId" in body ? [body.optionId] : null;
    if (!Array.isArray(submitted) || !submitted.length) throw new HttpError(400, "선택지를 선택해주세요.");
    const optionIds = [...new Set(submitted.map(databaseId))];
    if (optionIds.length > 20 || (poll.vote_mode === "single" && optionIds.length !== 1)) throw new HttpError(400, "투표 방식에 맞는 선택지를 선택해주세요.");
    return submitVote(client, poll.id, optionIds, participantId);
  });
}
