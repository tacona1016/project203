import { databaseId, handleApi, requireApiSession, requireSameOrigin, uuid } from "@/lib/auth/http";
import { getBoardEngagement } from "@/lib/board/engagement";
import { requireImageOwner, uploadBoardImage } from "@/lib/board/image-data";
import { noBoardQuery, readBoardBytes } from "@/lib/board/feature-http";
import { BOARD_IMAGES } from "@/lib/board/image-policy";
export const runtime = "nodejs";
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  return handleApi(async () => { await requireApiSession(); noBoardQuery(request); return (await getBoardEngagement(databaseId((await params).id))).images; });
}
export async function POST(request: Request, { params }: Context) {
  return handleApi(async () => {
    await requireApiSession(); requireSameOrigin(request); noBoardQuery(request);
    const id = databaseId((await params).id), imageId = uuid(request.headers.get("idempotency-key"));
    await requireImageOwner(id);
    const bytes = await readBoardBytes(request, BOARD_IMAGES.bytes);
    return uploadBoardImage(id, imageId, bytes, request.headers.get("content-type") ?? "");
  });
}
