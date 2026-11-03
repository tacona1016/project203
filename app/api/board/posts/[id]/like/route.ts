import { databaseId, handleApi, requireApiSession } from "@/lib/auth/http";
import { getBoardEngagement, setBoardLike } from "@/lib/board/engagement";
import { emptyBoardMutation, noBoardQuery } from "@/lib/board/feature-http";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  return handleApi(async () => { await requireApiSession(); noBoardQuery(request); return (await getBoardEngagement(databaseId((await params).id))).post; });
}
async function change(request: Request, { params }: Context, liked: boolean) {
  return handleApi(async () => { await requireApiSession(); await emptyBoardMutation(request); return setBoardLike(databaseId((await params).id), null, liked); });
}
export async function PUT(request: Request, context: Context) { return change(request, context, true); }
export async function DELETE(request: Request, context: Context) { return change(request, context, false); }
