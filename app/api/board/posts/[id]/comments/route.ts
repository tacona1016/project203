import { databaseId, handleApi, HttpError, readJson, requireSameOrigin } from "@/lib/auth/http";
import { protectedClient } from "@/lib/site-data";
import { boardCommentInput, boardPage } from "@/lib/board/validation";
import { createBoardComment, getBoardComments } from "@/lib/board/data";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  return handleApi(async () => { await protectedClient(); let page;
    try { page = boardPage(new URL(request.url).searchParams.get("page")); } catch (error) { throw new HttpError(400, (error as Error).message); }
    return getBoardComments(databaseId((await params).id), page); });
}
export async function POST(request: Request, { params }: Context) {
  return handleApi(async () => { await protectedClient(); requireSameOrigin(request);
    const body = await readJson(request); let content;
    try { content = boardCommentInput(body); } catch (error) { throw new HttpError(400, (error as Error).message); }
    return createBoardComment(databaseId((await params).id), content); });
}
