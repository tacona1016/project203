import { databaseId, handleApi, requireApiSession } from "@/lib/auth/http";
import { getBoardEngagement, setBoardLike } from "@/lib/board/engagement";
import { emptyBoardMutation, noBoardQuery } from "@/lib/board/feature-http";
type Context = { params: Promise<{ id: string; commentId: string }> };
export async function GET(request: Request, { params }: Context) {
  return handleApi(async () => { await requireApiSession(); noBoardQuery(request); const p = await params, id = databaseId(p.commentId); return (await getBoardEngagement(databaseId(p.id), [id])).comments[id]; });
}
async function change(request: Request, { params }: Context, liked: boolean) {
  return handleApi(async () => { await requireApiSession(); await emptyBoardMutation(request); const p = await params; return setBoardLike(databaseId(p.id), databaseId(p.commentId), liked); });
}
export async function PUT(request: Request, context: Context) { return change(request, context, true); }
export async function DELETE(request: Request, context: Context) { return change(request, context, false); }
