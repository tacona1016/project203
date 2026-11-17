import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, DatabaseId } from "@/lib/supabase/types";
import { protectedClient, pollSlug } from "@/lib/site-data";
import { requireAdminApiSession, getAdminSession } from "@/lib/auth/admin-session";
import { HttpError, requireApiSession } from "@/lib/auth/http";
import { encodePrivateImage, ImageInputError } from "@/lib/images/codec";
import { POLL_IMAGES, missingPollImageSchema, publicPollImage, type PollImageRecord, type PollImageSet } from "./model";

type Client = SupabaseClient<Database>;
const fields = "id,poll_id,option_id,byte_size,width,height,sort_order" as const;
export async function getPollImages(client: Client, pollId: DatabaseId): Promise<PollImageSet> {
  try {
    const { data, error } = await client.from("poll_images").select(fields).eq("poll_id", pollId).eq("state", "ready").order("sort_order").retry(false);
    if (error) return missingPollImageSchema(error) ? { available: false, images: [] } : { available: true, images: [], error: "첨부 사진을 불러오지 못했습니다. 새로고침 후 다시 확인해주세요." };
    return { available: true, images: data ?? [] };
  } catch { return { available: true, images: [], error: "첨부 사진을 불러오지 못했습니다. 새로고침 후 다시 확인해주세요." }; }
}
export async function pollImageTarget(slug: string, admin = false) {
  const actor = await requireApiSession();
  if (admin) await requireAdminApiSession();
  const client = await protectedClient();
  const { data, error } = await client.rpc("get_poll_detail", { p_slug: pollSlug(slug), p_admin: admin || !!await getAdminSession() }).retry(false);
  if (error) throw new HttpError(503, "투표를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.");
  if (!data) throw new HttpError(404, "투표를 찾지 못했습니다.");
  if (data.poll.is_hidden && !admin && !await getAdminSession()) throw new HttpError(404, "투표를 찾지 못했습니다.");
  return { actor, client, poll: data.poll, options: data.options };
}
function checked<T>(result: { data: T | null; error: { code?: string; message?: string } | null }): T {
  if (result.error) {
    if (missingPollImageSchema(result.error)) throw new HttpError(503, "투표 이미지 DB 적용이 필요합니다. 기존 투표는 그대로 사용할 수 있습니다.");
    if (["23514", "23505", "40001"].includes(result.error.code ?? "")) throw new HttpError(409, "사진 개수 또는 처리 상태가 바뀌었습니다. 목록을 확인하고 잠시 후 재시도해주세요.");
    if (["22023", "23503"].includes(result.error.code ?? "")) throw new HttpError(400, "사진과 선택지의 연결을 확인해주세요.");
    throw new HttpError(503, "사진 처리를 확인하지 못했습니다. 상태를 확인하고 다시 시도해주세요.");
  }
  if (result.data === null) throw new HttpError(404, "사진을 찾지 못했습니다.");
  return result.data;
}
async function privateBucket(client: Client) {
  const { data, error } = await client.storage.getBucket(POLL_IMAGES.bucket);
  if (error || data?.public !== false) throw new HttpError(503, "비공개 투표 사진 저장소 설정이 필요합니다.");
}
async function mutation(target: Awaited<ReturnType<typeof pollImageTarget>>, action: string, data: Record<string, unknown>) {
  return checked(await target.client.rpc("manage_poll_image", { p_poll_id: target.poll.id, p_actor_id: target.actor.participantId, p_action: action, p_data: data }).retry(false)) as PollImageRecord;
}
async function record(client: Client, pollId: DatabaseId, imageId: string) {
  return client.from("poll_images").select("*").eq("poll_id", pollId).eq("id", imageId).maybeSingle().retry(false);
}
async function purge(target: Awaited<ReturnType<typeof pollImageTarget>>, item: PollImageRecord) {
  const removed = await target.client.storage.from(POLL_IMAGES.bucket).remove([item.storage_path]);
  if (removed.error) throw new HttpError(503, "사진 삭제가 완료되지 않았습니다. 잠시 후 삭제를 재시도해주세요.");
  const purged = await target.client.rpc("manage_poll_image", { p_poll_id: target.poll.id, p_actor_id: target.actor.participantId, p_action: "purge", p_data: { id: item.id, token: item.upload_token } }).retry(false);
  const result = checked(purged);
  if (!("deleted" in result) || !result.deleted) throw new HttpError(409, "사진 처리 상태가 바뀌었습니다. 상태를 확인하고 다시 시도해주세요.");
}
export async function uploadPollImage(slug: string, id: string, optionId: string | null, replacesId: string | null, bytes: Uint8Array, type: string) {
  const target = await pollImageTarget(slug, true);
  if (optionId !== null && !target.options.some(option => String(option.id) === optionId)) throw new HttpError(400, "이 투표의 선택지가 아닙니다.");
  await privateBucket(target.client);
  let encoded;
  try { encoded = await encodePrivateImage(bytes, type, POLL_IMAGES); }
  catch (error) { if (error instanceof ImageInputError) throw new HttpError(error.status, error.message); throw error; }
  if (!encoded.bytes.length || encoded.bytes.length > POLL_IMAGES.storedBytes) throw new HttpError(413, "이미지 압축 결과가 500KB를 초과했습니다.");
  const item = await mutation(target, "reserve", { id, option_id: optionId, replaces_id: replacesId, token: randomUUID(), sha256: encoded.sha256, byte_size: encoded.bytes.length, width: encoded.width, height: encoded.height });
  if (item.state === "ready") return publicPollImage(item);
  try {
    // No upsert; the UUID and encoded SHA are stable across retries.
    const uploaded = await target.client.storage.from(POLL_IMAGES.bucket).upload(item.storage_path, encoded.bytes, { contentType: "image/webp", upsert: false, cacheControl: "0" });
    if (uploaded.error && !/409|Duplicate|already exists/i.test(`${uploaded.error.message} ${"statusCode" in uploaded.error ? uploaded.error.statusCode : ""}`)) throw uploaded.error;
    // Always read back before ready: neither an upload ACK nor Content-Type
    // alone proves that Storage contains the expected final bytes.
    const saved = await target.client.storage.from(POLL_IMAGES.bucket).download(item.storage_path);
    if (saved.error || !saved.data) throw new Error("Storage verification failed");
    const stored = new Uint8Array(await saved.data.arrayBuffer());
    if (stored.length !== encoded.bytes.length || createHash("sha256").update(stored).digest("hex") !== encoded.sha256) throw new Error("Storage mismatch");
    const ready = await mutation(target, "finish", { id, token: item.upload_token });
    // Swapping was atomic. Failure to clean the old object cannot roll back a
    // confirmed new image; deleting rows remain tracked for bounded cleanup.
    if (item.replaces_id) {
      const old = await record(target.client, target.poll.id, item.replaces_id);
      if (!old.error && old.data?.state === "deleting") await purge(target, old.data).catch(() => undefined);
    }
    return publicPollImage(ready);
  } catch {
    const saved = await record(target.client, target.poll.id, id);
    if (!saved.error && saved.data?.state === "ready" && saved.data.sha256 === encoded.sha256) return publicPollImage(saved.data);
    // Never remove an uncertain object or its tracking row. A retry with the
    // same id/hash can reclaim its expired lease; the old ready image survives.
    throw new HttpError(503, "사진 압축·저장 상태를 확인하지 못했습니다. 기존 투표와 사진은 유지됩니다. 목록을 확인한 뒤 같은 사진을 재시도해주세요.");
  }
}
export async function deletePollImage(slug: string, id: string) {
  const target = await pollImageTarget(slug, true);
  await privateBucket(target.client);
  const result = await target.client.rpc("manage_poll_image", { p_poll_id: target.poll.id, p_actor_id: target.actor.participantId, p_action: "delete", p_data: { id, token: randomUUID() } }).retry(false);
  if (!result.error && !result.data) return { deleted: true };
  const item = checked(result) as PollImageRecord;
  await purge(target, item);
  return { deleted: true };
}
export async function reorderPollImages(slug: string, ids: string[]) {
  const target = await pollImageTarget(slug, true);
  await mutation(target, "reorder", { ids });
  return getPollImages(target.client, target.poll.id);
}
export async function readPollImage(slug: string, id: string) {
  const target = await pollImageTarget(slug);
  const item = checked(await record(target.client, target.poll.id, id));
  if (item.state !== "ready") throw new HttpError(404, "사진을 찾지 못했습니다.");
  await privateBucket(target.client);
  const image = await target.client.storage.from(POLL_IMAGES.bucket).download(item.storage_path);
  if (image.error || !image.data) throw new HttpError(503, "사진을 불러오지 못했습니다.");
  const bytes = new Uint8Array(await image.data.arrayBuffer());
  if (!bytes.length || bytes.length > POLL_IMAGES.storedBytes || bytes.length !== item.byte_size || createHash("sha256").update(bytes).digest("hex") !== item.sha256) throw new HttpError(503, "사진을 확인하지 못했습니다.");
  return bytes;
}
export async function cleanupPollImages(slug: string) {
  const target = await pollImageTarget(slug, true);
  await privateBucket(target.client);
  const rows = checked(await target.client.from("poll_images").select("id").eq("poll_id", target.poll.id).neq("state", "ready").lt("updated_at", new Date(Date.now() - 300_000).toISOString()).limit(5).retry(false));
  let cleaned = 0;
  for (const row of rows) { await deletePollImage(slug, row.id); cleaned++; }
  return { cleaned };
}
