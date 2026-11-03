import "server-only";
import { protectedClient } from "@/lib/site-data";
import { requireBoardActor } from "@/lib/auth/board-session";
import { HttpError } from "@/lib/auth/http";
import type { DatabaseId } from "@/lib/supabase/types";
import type { BoardEngagement, LikeState } from "./types";

export function boardFeatureResult<T>(result: { data: T | null; error: { code?: string } | null }): T {
  if (result.error?.code === "P4030") throw new HttpError(403, "이 작업을 수행할 권한이 없습니다.");
  if (result.error?.code === "P4040") throw new HttpError(404, "게시글 또는 댓글을 찾지 못했습니다.");
  if (result.error?.code === "P4090") throw new HttpError(409, "진행 중인 작업이나 사진 개수·용량을 확인한 후 다시 시도해주세요.");
  if (["22023", "23514"].includes(result.error?.code ?? "")) throw new HttpError(400, "입력 내용을 확인해주세요.");
  if (result.error || result.data === null) throw new HttpError(503, "기능을 불러오지 못했습니다. 설정 또는 연결 상태를 확인한 후 다시 시도해주세요.");
  return result.data;
}
export async function getBoardEngagement(postId: DatabaseId, commentIds: DatabaseId[] = []): Promise<BoardEngagement> {
  const actor = await requireBoardActor();
  return boardFeatureResult(await (await protectedClient()).rpc("get_board_engagement", { p_post_id: postId, p_actor_id: actor.participantId, p_comment_ids: commentIds }).retry(false));
}
export async function setBoardLike(postId: DatabaseId, commentId: DatabaseId | null, liked: boolean): Promise<LikeState> {
  const actor = await requireBoardActor();
  return boardFeatureResult(await (await protectedClient()).rpc("set_board_like", { p_post_id: postId, p_comment_id: commentId, p_actor_id: actor.participantId, p_liked: liked }).retry(false));
}
