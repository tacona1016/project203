import { handleApi, HttpError, readJson, requireSameOrigin } from "@/lib/auth/http";
import { adminClient, adminPollInput, checkAdminResult } from "@/lib/supabase/poll-admin";
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
    const data = adminPollInput(await readJson(request), false);
    const target = await getPoll(client, pollSlug((await params).slug), true);
    if (target.poll.quarter !== data.quarter && (target.results?.total_votes ?? 0) > 0) {
      throw new HttpError(409, "이미 투표가 존재하는 Poll은 분기를 변경할 수 없습니다.");
    }
    const hasVotes = (target.results?.total_votes ?? 0) > 0;
    if (hasVotes && (target.poll.poll_type !== data.poll_type || target.poll.vote_mode !== data.vote_mode)) {
      throw new HttpError(409, "응답이 있는 Poll은 유형과 투표 방식을 변경할 수 없습니다.");
    }
    if (!hasVotes && data.poll_type === "choice" && data.options.length < 2) throw new HttpError(400, "선택지는 최소 2개가 필요합니다.");
    return checkAdminResult(await client.rpc("admin_update_poll", { p_poll_id: target.poll.id, p_data: data }));
  });
}
