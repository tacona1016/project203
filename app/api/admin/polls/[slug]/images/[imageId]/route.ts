import { handleApi, uuid } from "@/lib/auth/http";
import { emptyBoardMutation } from "@/lib/board/feature-http";
import { deletePollImage } from "@/lib/poll-images/data";
export const runtime = "nodejs";
type Context = { params: Promise<{ slug: string; imageId: string }> };
export async function DELETE(request: Request, { params }: Context) {
  return handleApi(async () => { await emptyBoardMutation(request); const p = await params; return deletePollImage(p.slug, uuid(p.imageId)); });
}
