import { handleApi, HttpError, readJson, requireSameOrigin } from "@/lib/auth/http";
import { adminClient, checkAdminResult } from "@/lib/supabase/poll-admin";
import { pollSlug } from "@/lib/site-data";
import { getPoll } from "@/lib/supabase/queries";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handleApi(async () => {
    const client = await adminClient();
    requireSameOrigin(request);
    const { action } = await readJson(request);
    if (typeof action !== "string" || !["close", "reopen", "hide", "unhide"].includes(action)) throw new HttpError(400, "요청을 확인해주세요.");
    const target = await getPoll(client, pollSlug((await params).slug), true);
    return checkAdminResult(await client.rpc("admin_set_poll_state", { p_poll_id: target.poll.id, p_action: action }));
  });
}
