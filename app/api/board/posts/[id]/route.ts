import { databaseId, handleApi, HttpError, readJson, requireSameOrigin } from "@/lib/auth/http";
import { protectedClient } from "@/lib/site-data";
import { boardInput } from "@/lib/board/validation";
import { deleteBoardPost, getBoardPost, writeBoardPost } from "@/lib/board/data";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  return handleApi(async () => { await protectedClient(); return getBoardPost(databaseId((await params).id)); });
}
export async function PATCH(request: Request, { params }: Context) {
  return handleApi(async () => { await protectedClient(); requireSameOrigin(request);
    const body = await readJson(request, 65_536);
    let input; try { input = boardInput(body); } catch (error) { throw new HttpError(400, (error as Error).message); }
    return writeBoardPost(databaseId((await params).id), input); });
}
export async function DELETE(request: Request, { params }: Context) {
  return handleApi(async () => { await protectedClient(); requireSameOrigin(request); return deleteBoardPost(databaseId((await params).id)); });
}
