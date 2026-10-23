import { handleApi, HttpError, readJson, requireSameOrigin, uuid } from "@/lib/auth/http";
import { protectedClient, quarterSlug } from "@/lib/site-data";
import { getComments, insertComment } from "@/lib/supabase/queries";

export async function GET(request: Request) {
  return handleApi(async () => {
    const client = await protectedClient();
    const params = new URL(request.url).searchParams;
    const quarter = quarterSlug(params.get("quarter"));
    const offset = params.get("offset") ?? "0";
    if (!/^\d{1,7}$/.test(offset)) throw new HttpError(400, "목록 정보를 확인해주세요.");
    return getComments(client, quarter, Number(offset));
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const client = await protectedClient();
    requireSameOrigin(request);
    const body = await readJson(request);
    if (typeof body.content !== "string") throw new HttpError(400, "의견을 입력해주세요.");
    return insertComment(client, quarterSlug(body.quarter), uuid(body.participantId), body.content);
  });
}
