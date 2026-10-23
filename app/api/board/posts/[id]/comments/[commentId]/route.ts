import { databaseId, handleApi, requireSameOrigin } from "@/lib/auth/http";
import { protectedClient } from "@/lib/site-data";
import { deleteBoardComment } from "@/lib/board/data";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  return handleApi(async () => { await protectedClient(); requireSameOrigin(request);
    const { id, commentId } = await params; return deleteBoardComment(databaseId(id), databaseId(commentId)); });
}
