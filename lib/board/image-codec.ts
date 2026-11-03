import sharp from "sharp";
import { createHash } from "node:crypto";
import { BOARD_IMAGES, BOARD_IMAGE_TYPES, imageSignature } from "./image-policy.ts";

export class ImageInputError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export async function encodeBoardImage(bytes: Uint8Array, declaredType: string) {
  if (!bytes.length || bytes.length > BOARD_IMAGES.bytes) throw new ImageInputError(413, "사진은 한 장당 3MiB 이하로 선택해주세요.");
  if (!BOARD_IMAGE_TYPES.some(type => type === declaredType) || imageSignature(bytes) !== declaredType) throw new ImageInputError(415, "JPG·PNG·WebP 사진만 첨부할 수 있습니다. 파일 형식을 확인해주세요.");
  try {
    const decoder = sharp(bytes, { limitInputPixels: BOARD_IMAGES.pixels, failOn: "warning" });
    const meta = await decoder.metadata();
    if (!["jpeg", "png", "webp"].includes(meta.format ?? "") || (meta.pages ?? 1) > 1) throw new Error("Unsupported image");
    // Default Sharp output strips EXIF/GPS/ICC/XMP. Apply orientation first.
    const { data, info } = await decoder.rotate().resize({ width: BOARD_IMAGES.dimension, height: BOARD_IMAGES.dimension, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 }).timeout({ seconds: 10 }).toBuffer({ resolveWithObject: true });
    if (!data.length || data.length > BOARD_IMAGES.bytes) throw new ImageInputError(413, "변환한 사진이 너무 큽니다. 더 작은 사진을 선택해주세요.");
    return { bytes: data, width: info.width, height: info.height, sha256: createHash("sha256").update(data).digest("hex") };
  } catch (error) {
    if (error instanceof ImageInputError) throw error;
    throw new ImageInputError(415, "사진을 읽지 못했습니다. 손상되지 않은 일반 사진을 선택해주세요.");
  }
}
