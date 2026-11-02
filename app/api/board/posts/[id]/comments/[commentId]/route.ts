import { databaseId, handleApi, HttpError, readJson, requireSameOrigin } from "@/lib/auth/http";
import { protectedClient } from "@/lib/site-data";
import { deleteBoardComment, editBoardComment } from "@/lib/board/data";
import { boardCommentInput } from "@/lib/board/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  return handleApi(async () => { await protectedClient(); requireSameOrigin(request);
    const body = await readJson(request); let content;
    try { content = boardCommentInput(body); } catch (error) { throw new HttpError(400, (error as Error).message); }
    const { id, commentId } = await params;
    return editBoardComment(databaseId(id), databaseId(commentId), content);
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  return handleApi(async () => { await protectedClient(); requireSameOrigin(request);
    const { id, commentId } = await params; return deleteBoardComment(databaseId(id), databaseId(commentId)); });
}
