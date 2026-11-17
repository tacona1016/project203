import { databaseId, handleApi, HttpError, readJson, requireSameOrigin, uuid } from "@/lib/auth/http";
import { readBoardBytes, noBoardQuery } from "@/lib/board/feature-http";
import { getPollImages, pollImageTarget, uploadPollImage, reorderPollImages } from "@/lib/poll-images/data";
import { POLL_IMAGES } from "@/lib/poll-images/model";
export const runtime = "nodejs";
export const maxDuration = 60;
type Context = { params: Promise<{ slug: string }> };
export async function GET(request: Request, { params }: Context) {
  return handleApi(async () => { noBoardQuery(request); const target = await pollImageTarget((await params).slug, true); return getPollImages(target.client, target.poll.id); });
}
export async function POST(request: Request, { params }: Context) {
  return handleApi(async () => {
    requireSameOrigin(request); noBoardQuery(request);
    const slug = (await params).slug;
    await pollImageTarget(slug, true); // Reject unauthorized large bodies before reading/decoding.
    const id = uuid(request.headers.get("idempotency-key"));
    const option = request.headers.get("x-option-id"), replaces = request.headers.get("x-replaces-image-id");
    return uploadPollImage(slug, id, option === null ? null : databaseId(option), replaces === null ? null : uuid(replaces), await readBoardBytes(request, POLL_IMAGES.bytes), request.headers.get("content-type") ?? "");
  });
}
export async function PATCH(request: Request, { params }: Context) {
  return handleApi(async () => {
    requireSameOrigin(request); noBoardQuery(request);
    const slug = (await params).slug; await pollImageTarget(slug, true);
    const body = await readJson(request, 1024);
    if (!Array.isArray(body.ids) || body.ids.length > 3 || new Set(body.ids).size !== body.ids.length) throw new HttpError(400, "사진 순서를 확인해주세요.");
    return reorderPollImages(slug, body.ids.map(uuid));
  });
}
