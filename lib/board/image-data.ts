import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { protectedClient } from "@/lib/site-data";
import { requireBoardActor } from "@/lib/auth/board-session";
import { HttpError } from "@/lib/auth/http";
import { BOARD_IMAGES } from "./image-policy";
import { encodeBoardImage, ImageInputError } from "./image-codec";
import { boardFeatureResult } from "./engagement";
import type { BoardImage, BoardImageRecord } from "./types";
import type { DatabaseId } from "@/lib/supabase/types";

export function publicBoardImage(row: BoardImageRecord): BoardImage {
  return { id: row.id, post_id: row.post_id, content_type: row.content_type, byte_size: row.byte_size, width: row.width, height: row.height, sort_order: row.sort_order, created_at: row.created_at };
}
async function requirePrivateBucket(client: Awaited<ReturnType<typeof protectedClient>>) {
  const result = await client.storage.getBucket(BOARD_IMAGES.bucket);
  if (result.error || !result.data || result.data.public !== false) throw new HttpError(503, "비공개 사진 저장소 설정을 확인해주세요.");
}
export async function requireImageOwner(postId: DatabaseId) {
  const actor = await requireBoardActor(), client = await protectedClient();
  const post = boardFeatureResult(await client.rpc("get_board_post", { p_id: postId }).retry(false));
  if (post.author_id !== actor.participantId || post.post_type === "notice" && !actor.isAdmin) throw new HttpError(403, "사진은 게시글 작성자만 관리할 수 있습니다.");
  return { actor, client };
}
async function discardPending(client: Awaited<ReturnType<typeof protectedClient>>, item: BoardImageRecord) {
  // Never erase the tracking row if removal is uncertain. Explicit cleanup can
  // reclaim it later, including after a process crash or deleted parent.
  const claim = await client.rpc("abort_board_image", { p_id: item.id, p_token: item.upload_token }).retry(false);
  if (claim.error || !claim.data) return;
  const removed = await client.storage.from(BOARD_IMAGES.bucket).remove([claim.data.storage_path]);
  if (!removed.error) await client.rpc("purge_board_image", { p_id: item.id, p_token: item.upload_token }).retry(false);
}
export async function uploadBoardImage(postId: DatabaseId, imageId: string, input: Uint8Array, contentType: string) {
  const { actor, client } = await requireImageOwner(postId);
  await requirePrivateBucket(client);
  let encoded;
  try { encoded = await encodeBoardImage(input, contentType); }
  catch (error) { if (error instanceof ImageInputError) throw new HttpError(error.status, error.message); throw error; }
  // Defense in depth: never reserve/upload oversized output even if the codec
  // changes. Legacy GETs keep using the original 3 MiB read ceiling below.
  if (!encoded.bytes.length || encoded.bytes.length > BOARD_IMAGES.storedBytes) throw new HttpError(413, "이미지 압축 결과가 500KB를 초과했습니다.");
  const item = boardFeatureResult(await client.rpc("reserve_board_image", { p_post_id: postId, p_id: imageId, p_actor_id: actor.participantId, p_is_admin: actor.isAdmin,
    p_token: randomUUID(), p_hash: encoded.sha256, p_bytes: encoded.bytes.length, p_width: encoded.width, p_height: encoded.height }).retry(false));
  if (item.state === "ready") return publicBoardImage(item);
  try {
    const result = await client.storage.from(BOARD_IMAGES.bucket).upload(item.storage_path, encoded.bytes, { contentType: "image/webp", upsert: false, cacheControl: "0" });
    if (result.error) {
      // A prior attempt may have stored the exact object before losing its ACK.
      // On duplicate only, compare bytes; no upsert can replace another image.
      if (!/409|Duplicate|already exists/i.test(`${result.error.message} ${"statusCode" in result.error ? result.error.statusCode : ""}`)) throw result.error;
      const existing = await client.storage.from(BOARD_IMAGES.bucket).download(item.storage_path);
      if (existing.error || !existing.data || createHash("sha256").update(Buffer.from(await existing.data.arrayBuffer())).digest("hex") !== encoded.sha256) throw new Error("Object mismatch");
    }
    return publicBoardImage(boardFeatureResult(await client.rpc("finish_board_image", { p_post_id: postId, p_id: imageId, p_actor_id: actor.participantId, p_is_admin: actor.isAdmin, p_token: item.upload_token }).retry(false)));
  } catch {
    // A lost finalize ACK may already have committed. Check state before cleanup.
    const saved = await client.rpc("get_board_image", { p_post_id: postId, p_id: imageId }).retry(false);
    if (!saved.error && saved.data?.state === "ready") return publicBoardImage(saved.data);
    // If the state query itself failed, do not destroy a potentially ready image.
    if (!saved.error) await discardPending(client, item).catch(() => undefined);
    throw new HttpError(503, "사진 저장을 확인하지 못했습니다. 게시글은 유지됩니다. 사진 상태를 확인한 후 실패한 사진만 재시도해주세요.");
  }
}
export async function deleteBoardImage(postId: DatabaseId, imageId: string) {
  const { actor, client } = await requireImageOwner(postId);
  const result = await client.rpc("begin_board_image_delete", { p_post_id: postId, p_id: imageId, p_actor_id: actor.participantId, p_is_admin: actor.isAdmin, p_token: randomUUID() }).retry(false);
  if (!result.error && !result.data) return { deleted: true };
  const item = boardFeatureResult(result);
  const removed = await client.storage.from(BOARD_IMAGES.bucket).remove([item.storage_path]);
  if (removed.error) throw new HttpError(503, "사진 삭제를 완료하지 못했습니다. 다시 삭제를 시도해주세요.");
  const purged = boardFeatureResult(await client.rpc("purge_board_image", { p_id: imageId, p_token: item.upload_token }).retry(false));
  if (!purged.deleted) throw new HttpError(409, "사진 처리 상태가 바뀌었습니다. 다시 확인해주세요.");
  return purged;
}
export async function readBoardImage(postId: DatabaseId, imageId: string) {
  const client = await protectedClient();
  const row = await client.rpc("get_board_image", { p_post_id: postId, p_id: imageId }).retry(false);
  if (!row.error && !row.data) throw new HttpError(404, "사진을 찾지 못했습니다.");
  const item = boardFeatureResult(row);
  await requirePrivateBucket(client);
  const image = await client.storage.from(BOARD_IMAGES.bucket).download(item.storage_path);
  if (image.error || !image.data) throw new HttpError(503, "사진을 불러오지 못했습니다.");
  const bytes = new Uint8Array(await image.data.arrayBuffer());
  if (bytes.length !== item.byte_size || bytes.length > BOARD_IMAGES.bytes || createHash("sha256").update(bytes).digest("hex") !== item.sha256) throw new HttpError(503, "사진을 확인하지 못했습니다.");
  return bytes;
}
