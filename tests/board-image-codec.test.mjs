import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { encodeBoardImage } from "../lib/board/image-codec.ts";
import { BOARD_IMAGES, imageSignature } from "../lib/board/image-policy.ts";

test("Board photos decode real JPEG/PNG/WebP and produce bounded metadata-free WebP", async () => {
  for (const [format, type] of [["jpeg", "image/jpeg"], ["png", "image/png"], ["webp", "image/webp"]]) {
    const original = await sharp({ create: { width: 30, height: 20, channels: 3, background: "#c4d7e4" } }).toFormat(format).withExif({ IFD0: { Artist: "synthetic photo fixture", Orientation: "6" } }).toBuffer();
    assert((await sharp(original).metadata()).exif);
    const encoded = await encodeBoardImage(original, type), metadata = await sharp(encoded.bytes).metadata();
    assert.equal(metadata.format, "webp"); assert.equal(metadata.exif, undefined); assert.equal(metadata.xmp, undefined); assert.equal(metadata.icc, undefined);
    assert.equal(imageSignature(encoded.bytes), "image/webp"); assert(encoded.width <= 2400 && encoded.height <= 2400);
    assert.match(encoded.sha256, /^[0-9a-f]{64}$/);
  }
});
test("Board photos reject empty/oversize/forged MIME/signatures and unsupported formats", async () => {
  const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "red" } }).png().toBuffer();
  for (const [bytes, type, status] of [[new Uint8Array(), "image/png", 413], [new Uint8Array(BOARD_IMAGES.bytes + 1), "image/png", 413],
    [png, "image/jpeg", 415], [Buffer.from('<svg onload="alert(1)"/>'), "image/png", 415], [Buffer.from("GIF89a"), "image/gif", 415],
    [Buffer.concat([png.subarray(0, 8), Buffer.from("fake pixels")]), "image/png", 415], [png, "image/heic", 415]])
    await assert.rejects(encodeBoardImage(bytes, type), error => error.status === status);
});
test("Board photos enforce decompressed pixel limits before accepting an image", async () => {
  const large = await sharp({ create: { width: 5000, height: 4000, channels: 3, background: "white" } }).png().toBuffer();
  assert(large.length < BOARD_IMAGES.bytes);
  await assert.rejects(encodeBoardImage(large, "image/png"), error => error.status === 415);
});
