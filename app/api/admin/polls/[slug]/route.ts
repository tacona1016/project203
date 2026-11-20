import { handleApi, HttpError, readJson, requireSameOrigin } from "@/lib/auth/http";
import { adminClient, adminPollInput, checkAdminResult, requireChoiceLimitSchema } from "@/lib/supabase/poll-admin";
import { pollSlug } from "@/lib/site-data";
import { getPoll } from "@/lib/supabase/queries";

type Context = { params: Promise<{ slug: string }> };
export async function GET(_request: Request, { params }: Context) {
  return handleApi(async () => getPoll(await adminClient(), pollSlug((await params).slug), true));
}
export async function PATCH(request: Request, { params }: Context) {
  return handleApi(async () => {
    const client = await adminClient();
    requireSameOrigin(request);
    const body = await readJson(request);
    const data = adminPollInput(body, false);
    const target = await getPoll(client, pollSlug((await params).slug), true);
    // Older clients that omit the new field must not reset a saved limit.
    if (!Object.hasOwn(body, "max_choices_per_participant")) data.max_choices_per_participant = target.poll.max_choices_per_participant ?? null;
    const hasVotes = target.has_responses ?? (target.results?.total_votes ?? 0) > 0;
    if (hasVotes && data.max_choices_per_participant !== (target.poll.max_choices_per_participant ?? null)) {
      throw new HttpError(409, "이미 참여 기록이 있어 최대 선택 개수를 변경할 수 없습니다.");
    }
    const optionCount = data.options.length || target.options.length;
    if (data.max_choices_per_participant !== null && (data.poll_type !== "choice" || data.vote_mode !== "multiple" || data.max_choices_per_participant > optionCount)) {
      throw new HttpError(400, "최대 선택 개수는 객관식 복수선택의 실제 선택지 수 이내로 설정해주세요.");
    }
    await requireChoiceLimitSchema(client, data.max_choices_per_participant);
    if (target.poll.quarter !== data.quarter && hasVotes) {
      throw new HttpError(409, "이미 투표가 존재하는 Poll은 분기를 변경할 수 없습니다.");
    }
    const changesOptions = target.poll.poll_type !== data.poll_type || data.options.length > 0 && JSON.stringify(target.options.map(option => option.label)) !== JSON.stringify(data.options);
    if (changesOptions && target.attachments?.images.some(image => image.option_id !== null)) throw new HttpError(409, "선택지 사진을 먼저 삭제한 뒤 선택지를 수정해주세요. 기존 응답이 있는 선택지는 변경할 수 없습니다.");
    if (hasVotes && (target.poll.poll_type !== data.poll_type || target.poll.vote_mode !== data.vote_mode)) {
      throw new HttpError(409, "응답이 있는 Poll은 유형과 투표 방식을 변경할 수 없습니다.");
    }
    if (!hasVotes && data.poll_type === "choice" && data.options.length < 2) throw new HttpError(400, "선택지는 최소 2개가 필요합니다.");
    return checkAdminResult(await client.rpc("admin_update_poll", { p_poll_id: target.poll.id, p_data: data }));
  });
}
