import { after, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { encodeBoardImage } from "../lib/board/image-codec.ts";
import { BOARD_IMAGES, imageSignature } from "../lib/board/image-policy.ts";
import { detailedJpeg, landscapeJpeg, noisePixels, textPng, transparentPng } from "./fixtures/board-photo-samples.mjs";

const samples = [];
after(async () => {
  await mkdir(".verification", { recursive: true });
  await writeFile(".verification/compression-samples.json", JSON.stringify({ source: "synthetic fixtures, not user photos", samples }, null, 2) + "\n");
});
async function checked(input, type) {
  const encoded = await encodeBoardImage(input, type), meta = await sharp(encoded.bytes).metadata();
  assert(encoded.bytes.length > 0 && encoded.bytes.length <= 500_000);
  assert.equal(meta.format, "webp"); assert.equal(meta.exif, undefined); assert.equal(meta.xmp, undefined); assert.equal(meta.icc, undefined);
  assert.equal(meta.orientation, undefined); assert.equal(imageSignature(encoded.bytes), "image/webp");
  assert.equal(meta.width, encoded.width); assert.equal(meta.height, encoded.height);
  assert(encoded.width <= 1920 && encoded.height <= 1920);
  assert(encoded.attempts <= 35); assert(encoded.attempts >= 1);
  assert.equal(encoded.sha256, createHash("sha256").update(encoded.bytes).digest("hex"));
  const original = await sharp(input).metadata(), rotated = [5, 6, 7, 8].includes(original.orientation);
  const width = rotated ? original.height : original.width, height = rotated ? original.width : original.height;
  assert(encoded.width <= width && encoded.height <= height, "No upscaling");
  assert(Math.abs(encoded.width * height - encoded.height * width) <= Math.max(width, height), "Preserve aspect ratio within one rounded pixel");
  return encoded;
}

test("Board photos decode real JPEG/PNG/WebP and produce bounded metadata-free WebP", async () => {
  for (const [format, type] of [["jpeg", "image/jpeg"], ["png", "image/png"], ["webp", "image/webp"]]) {
    const original = await sharp({ create: { width: 30, height: 20, channels: 3, background: "#c4d7e4" } }).toFormat(format).withExif({ IFD0: { Artist: "synthetic photo fixture", Orientation: "6" } }).toBuffer();
    assert((await sharp(original).metadata()).exif);
    assert(original.length < 500_000);
    await checked(original, type);
  }
});

for (const [label, make, type] of [
  ["1MB high-detail photograph", () => detailedJpeg(), "image/jpeg"],
  ["photograph near the 3MiB input ceiling", () => detailedJpeg(2000, 1500, 93), "image/jpeg"],
  ["12MP smartphone resolution", () => landscapeJpeg(4032, 3024), "image/jpeg"],
  ["landscape", landscapeJpeg, "image/jpeg"],
  ["text and line art", textPng, "image/png"],
]) test(`Automatic compression: ${label}`, async () => {
  const original = await make(); assert(original.length <= BOARD_IMAGES.bytes);
  if (label.includes("photograph")) assert(original.length > 1_000_000);
  const start = performance.now(), encoded = await checked(original, type);
  if (label.includes("photograph")) { assert(encoded.attempts > 7); assert(encoded.width < 1600); }
  samples.push({ label, originalBytes: original.length, storedBytes: encoded.bytes.length, width: encoded.width, height: encoded.height, quality: encoded.quality, attempts: encoded.attempts, elapsedMs: Math.round(performance.now() - start) });
});

test("Transparent PNG retains fully and partly transparent alpha without metadata", async () => {
  const original = await transparentPng(), encoded = await checked(original, "image/png");
  assert((await sharp(encoded.bytes).metadata()).hasAlpha);
  const alpha = await sharp(encoded.bytes).extractChannel("alpha").raw().toBuffer();
  assert(alpha.equals(await sharp(original).extractChannel("alpha").raw().toBuffer()), "Alpha bytes must be preserved exactly");
  samples.push({ label: "transparent PNG", originalBytes: original.length, storedBytes: encoded.bytes.length, width: encoded.width, height: encoded.height, quality: encoded.quality, attempts: encoded.attempts });
});

test("EXIF orientation is applied to pixels and stripped from the stored WebP", async () => {
  const original = await sharp({ create: { width: 80, height: 40, channels: 3, background: "#547ca3" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const encoded = await checked(original, "image/jpeg");
  assert.equal(encoded.width, 40); assert.equal(encoded.height, 80);
});

test("Compression is deterministic for a retried image's final hash", async () => {
  const original = await landscapeJpeg(800, 600);
  const first = await checked(original, "image/jpeg"), retry = await checked(original, "image/jpeg");
  assert.equal(retry.sha256, first.sha256); assert.deepEqual(retry.bytes, first.bytes);
});

test("An image that cannot fit the bounded candidates never falls back to an oversized original", async () => {
  const { data, raw } = noisePixels(800, 800, 4), original = await sharp(data, { raw }).png().toBuffer();
  assert(original.length <= BOARD_IMAGES.bytes);
  await assert.rejects(encodeBoardImage(original, "image/png"), error => error.status === 413 && /500KB/.test(error.message));
});

test("The whole processing deadline includes time spent waiting for Sharp", async (context) => {
  const input = await sharp({ create: { width: 8, height: 8, channels: 3, background: "red" } }).png().toBuffer();
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const failure = assert.rejects(encodeBoardImage(input, "image/png"), error => error.status === 503 && /시간/.test(error.message));
  context.mock.timers.tick(20_001);
  await failure;
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
