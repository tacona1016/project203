// Keep the original/read limit for uploads and legacy images. New stored bytes
// have a separate, decimal 500 KB ceiling; do not tighten legacy image reads.
export const BOARD_IMAGES = { maximum: 3, bytes: 3 * 1024 * 1024, storedBytes: 500_000, pixels: 16_000_000, dimension: 1920, bucket: "board-attachments" } as const;
export { IMAGE_TYPES as BOARD_IMAGE_TYPES, imageSignature } from "../images/signature.ts";
export type { ImageType as BoardImageType } from "../images/signature.ts";
export function boardImageUrl(postId: string | number, imageId: string) {
  return `/api/board/posts/${postId}/images/${imageId}`;
}
