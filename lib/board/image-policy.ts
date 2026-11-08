// Keep the original/read limit for uploads and legacy images. New stored bytes
// have a separate, decimal 500 KB ceiling; do not tighten legacy image reads.
export const BOARD_IMAGES = { maximum: 3, bytes: 3 * 1024 * 1024, storedBytes: 500_000, pixels: 16_000_000, dimension: 1920, bucket: "board-attachments" } as const;
export const BOARD_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type BoardImageType = typeof BOARD_IMAGE_TYPES[number];

export function imageSignature(bytes: Uint8Array): BoardImageType | null {
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value)) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP") return "image/webp";
  return null;
}
export function boardImageUrl(postId: string | number, imageId: string) {
  return `/api/board/posts/${postId}/images/${imageId}`;
}
