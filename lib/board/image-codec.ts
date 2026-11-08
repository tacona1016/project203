import sharp from "sharp";
import { createHash } from "node:crypto";
import { BOARD_IMAGES, BOARD_IMAGE_TYPES, imageSignature } from "./image-policy.ts";

const DIMENSIONS = [BOARD_IMAGES.dimension, 1600, 1280, 1024, 800] as const;
const QUALITIES = [82, 76, 70, 64, 58, 52, 45] as const;
const PROCESSING_BUDGET_MS = 20_000;

export class ImageInputError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export async function encodeBoardImage(bytes: Uint8Array, declaredType: string) {
  if (!bytes.length || bytes.length > BOARD_IMAGES.bytes) throw new ImageInputError(413, "사진은 한 장당 3MiB 이하로 선택해주세요.");
  if (!BOARD_IMAGE_TYPES.some(type => type === declaredType) || imageSignature(bytes) !== declaredType) throw new ImageInputError(415, "JPG·PNG·WebP 사진만 첨부할 수 있습니다. 파일 형식을 확인해주세요.");
  const deadline = performance.now() + PROCESSING_BUDGET_MS;
  const timeoutError = () => new ImageInputError(503, "사진 압축 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.");
  function remainingMilliseconds() {
    const remaining = deadline - performance.now();
    if (remaining <= 0) throw timeoutError();
    return remaining;
  }
  async function run<T>(pipeline: ReturnType<typeof sharp>, operation: () => Promise<T>): Promise<T> {
    const remaining = remainingMilliseconds();
    pipeline.timeout({ seconds: Math.max(1, Math.ceil(remaining / 1000)) });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Sharp's timeout excludes thread-queue time. Also bound the request's
      // whole deadline and destroy the stream when that deadline is reached.
      const result = await Promise.race([operation(), new Promise<never>((_, reject) => {
        timer = setTimeout(() => { pipeline.destroy(); reject(timeoutError()); }, remaining);
      })]);
      remainingMilliseconds();
      return result;
    } finally { clearTimeout(timer); }
  }
  try {
    const decoder = sharp(bytes, { limitInputPixels: BOARD_IMAGES.pixels, failOn: "warning" });
    const meta = await run(decoder, () => decoder.metadata());
    if (!["jpeg", "png", "webp"].includes(meta.format ?? "") || (meta.pages ?? 1) > 1) throw new Error("Unsupported image");
    // Decode/orient once. Raw sRGB pixels retain alpha but carry no EXIF/GPS,
    // ICC or XMP; retries never recompress a previously lossy WebP candidate.
    decoder.rotate().resize({ width: BOARD_IMAGES.dimension, height: BOARD_IMAGES.dimension, fit: "inside", withoutEnlargement: true }).toColourspace("srgb").raw();
    const normalized = await run(decoder, () => decoder.toBuffer({ resolveWithObject: true }));
    let attempts = 0, previousDimension = Infinity;
    for (const dimension of DIMENSIONS) {
      const actualDimension = Math.min(dimension, Math.max(normalized.info.width, normalized.info.height));
      if (actualDimension === previousDimension) continue;
      previousDimension = actualDimension;
      const resized = sharp(normalized.data, { raw: { width: normalized.info.width, height: normalized.info.height, channels: normalized.info.channels } })
        .resize({ width: dimension, height: dimension, fit: "inside", withoutEnlargement: true }).raw();
      const frame = dimension === BOARD_IMAGES.dimension ? normalized : await run(resized, () => resized.toBuffer({ resolveWithObject: true }));
      for (const quality of QUALITIES) {
        // At most 5 dimensions x 7 qualities. Prefer resolution, then the
        // highest tested quality that actually meets the byte ceiling.
        attempts++;
        const encoder = sharp(frame.data, { raw: { width: frame.info.width, height: frame.info.height, channels: frame.info.channels } }).webp({ quality, alphaQuality: 100, effort: 4 });
        const { data, info } = await run(encoder, () => encoder.toBuffer({ resolveWithObject: true }));
        if (data.length > 0 && data.length <= BOARD_IMAGES.storedBytes) {
          return { bytes: data, width: info.width, height: info.height, quality, attempts, sha256: createHash("sha256").update(data).digest("hex") };
        }
      }
    }
    throw new ImageInputError(413, "사진을 500KB 이하로 압축하지 못했습니다. 다른 사진을 선택해주세요.");
  } catch (error) {
    if (error instanceof ImageInputError) throw error;
    if (performance.now() >= deadline || error instanceof Error && /timeout/i.test(error.message)) throw timeoutError();
    throw new ImageInputError(415, "사진을 읽지 못했습니다. 손상되지 않은 일반 사진을 선택해주세요.");
  }
}
