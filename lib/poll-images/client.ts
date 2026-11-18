import { POLL_IMAGES, type PollImage, type PollImageSet } from "./model.ts";
import { IMAGE_TYPES } from "../images/signature.ts";

export class PollRequestError extends Error {
  status?: number;
  constructor(message: string, status?: number) { super(message); this.status = status; }
}
export async function pollImageRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
  let value;
  try { value = await response.json(); }
  catch { throw new PollRequestError("서버 응답을 확인하지 못했습니다. 저장 상태를 확인한 후 다시 시도해주세요.", response.ok ? undefined : response.status); }
  if (!response.ok) throw new PollRequestError(value.error ?? "사진 처리를 확인하지 못했습니다.", response.status);
  return value;
}
export function validatePollImageFile(file: Pick<File, "type" | "size">) {
  if (!IMAGE_TYPES.some(type => type === file.type) || !file.size || file.size > POLL_IMAGES.bytes) throw new Error("JPG·PNG·WebP 원본 3MiB 이하 사진을 선택해주세요.");
}
export async function listPollImages(slug: string) {
  const next = await pollImageRequest<PollImageSet>(`/api/admin/polls/${slug}/images`);
  if (!next.available || next.error || !Array.isArray(next.images)) throw new Error(next.error ?? "투표 사진 저장소 설정 또는 응답을 확인해주세요.");
  return next.images;
}
export async function sendPollImage(slug: string, item: { id: string; file: File; optionId: string | null; replacesId: string | null }) {
  validatePollImageFile(item.file);
  const base = `/api/admin/polls/${slug}/images`;
  const headers: Record<string, string> = { "Content-Type": item.file.type, "Idempotency-Key": item.id };
  if (item.optionId) headers["X-Option-Id"] = item.optionId;
  if (item.replacesId) headers["X-Replaces-Image-Id"] = item.replacesId;
  let saved: PollImage;
  try { saved = await pollImageRequest<PollImage>(base, { method: "POST", headers, body: item.file }); }
  catch (error) { const images = await listPollImages(slug).catch(() => null); const confirmed = images?.find(image => image.id === item.id); if (!confirmed) throw error; saved = confirmed; }
  if (saved.id !== item.id || String(saved.option_id) !== String(item.optionId) || !Number.isSafeInteger(saved.byte_size) || saved.byte_size <= 0 || saved.byte_size > POLL_IMAGES.storedBytes) throw new Error("사진 저장 결과를 확인하지 못했습니다.");
  return saved;
}
