import "server-only";
import { protectedClient } from "@/lib/site-data";
import { HttpError } from "@/lib/auth/http";
import { requireBoardActor } from "@/lib/auth/board-session";
import { canManageBoardPost } from "./validation";
import type { BoardInput } from "./types";
import type { DatabaseId } from "@/lib/supabase/types";

function checked<T>({ data, error }: { data: T | null; error: { code?: string } | null }): T {
  if (error?.code === "P4030") throw new HttpError(403, "이 작업을 수행할 권한이 없습니다.");
  if (error?.code === "P4040") throw new HttpError(404, "게시글 또는 댓글을 찾지 못했습니다.");
  if (error?.code === "22023" || error?.code === "23514") throw new HttpError(400, "입력 내용을 확인해주세요.");
  if (error || data === null) throw new HttpError(503, "게시판을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
  return data;
}
export async function getBoardPage(search: string, page: number) {
  return checked(await (await protectedClient()).rpc("get_board_page", { p_search: search, p_page: page }));
}
export async function getBoardPost(id: DatabaseId) {
  const result = await (await protectedClient()).rpc("get_board_post", { p_id: id });
  if (!result.error && result.data === null) throw new HttpError(404, "게시글을 찾지 못했습니다.");
  return checked(result);
}
export async function getBoardComments(id: DatabaseId, page = 1) {
  return checked(await (await protectedClient()).rpc("get_board_comments", { p_post_id: id, p_page: page }));
}
export async function writeBoardPost(id: DatabaseId | null, input: BoardInput) {
  const actor = await requireBoardActor();
  if (!actor.isAdmin && (input.post_type !== "general" || input.is_pinned)) throw new HttpError(403, "공지사항은 관리자만 관리할 수 있습니다.");
  if (id !== null && !canManageBoardPost(await getBoardPost(id), { ...actor, verified: true })) throw new HttpError(403, "본인이 작성한 일반 게시글만 수정할 수 있습니다.");
  return checked(await (await protectedClient()).rpc("write_board_post", { p_id: id, p_actor_id: actor.participantId, p_is_admin: actor.isAdmin,
    p_title: input.title, p_content: input.content, p_post_type: input.post_type, p_is_pinned: input.is_pinned }));
}
export async function deleteBoardPost(id: DatabaseId) {
  const actor = await requireBoardActor();
  if (!canManageBoardPost(await getBoardPost(id), { ...actor, verified: true })) throw new HttpError(403, "이 게시글을 삭제할 권한이 없습니다.");
  return checked(await (await protectedClient()).rpc("delete_board_post", { p_id: id, p_actor_id: actor.participantId, p_is_admin: actor.isAdmin }));
}
export async function createBoardComment(id: DatabaseId, content: string) {
  const actor = await requireBoardActor();
  return checked(await (await protectedClient()).rpc("create_board_comment", { p_post_id: id, p_actor_id: actor.participantId, p_content: content }));
}
export async function deleteBoardComment(postId: DatabaseId, id: DatabaseId) {
  const actor = await requireBoardActor();
  return checked(await (await protectedClient()).rpc("delete_board_comment", { p_post_id: postId, p_id: id, p_actor_id: actor.participantId, p_is_admin: actor.isAdmin }));
}
