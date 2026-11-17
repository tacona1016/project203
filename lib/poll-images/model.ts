export const POLL_IMAGES = { maximum: 3, bytes: 3 * 1024 * 1024, storedBytes: 500_000, pixels: 16_000_000, dimension: 1920, bucket: "poll-attachments" } as const;
export type PollImage = {
  id: string; poll_id: string | number; option_id: string | number | null;
  byte_size: number; width: number; height: number; sort_order: number;
};
export type PollImageRecord = PollImage & {
  storage_path: string; content_type: string; sha256: string; state: "pending" | "ready" | "deleting";
  upload_token: string; replaces_id: string | null; uploaded_by: string; updated_at: string;
};
export type PollImageSet = { available: boolean; images: PollImage[]; error?: string };
export function publicPollImage(row: PollImageRecord): PollImage {
  return { id: row.id, poll_id: row.poll_id, option_id: row.option_id, byte_size: row.byte_size, width: row.width, height: row.height, sort_order: row.sort_order };
}
export function pollImageUrl(slug: string, id: string) { return `/api/polls/${encodeURIComponent(slug)}/images/${id}`; }
export function optionImage(images: PollImage[], optionId: string | number) { return images.find(image => image.option_id !== null && String(image.option_id) === String(optionId)); }
export function missingPollImageSchema(error: { code?: string; message?: string }) {
  return ["42P01", "PGRST205", "PGRST202", "42883"].includes(error.code ?? "") && /poll_images|manage_poll_image/.test(error.message ?? "");
}
