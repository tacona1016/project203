// Deterministic synthetic pixels only: no private photos, network or DB access.
import sharp from "sharp";

export function noisePixels(width, height, channels = 3, seed = 203) {
  const data = Buffer.alloc(width * height * channels);
  let value = seed;
  for (let i = 0; i < data.length; i++) {
    value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
    data[i] = value >>> 24;
  }
  return { data, raw: { width, height, channels } };
}

export async function detailedJpeg(width = 1600, height = 1200, quality = 75) {
  const { data, raw } = noisePixels(width, height);
  return sharp(data, { raw }).jpeg({ quality }).toBuffer();
}

export async function landscapeJpeg(width = 1920, height = 1280) {
  const { data, raw } = noisePixels(width, height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const at = (y * width + x) * 3, noise = data[at] % 15 - 7;
    const hill = height * (0.55 + 0.12 * Math.sin(x / width * 8));
    const color = y < hill ? [110 + y / height * 65, 160 + y / height * 45, 220] : [70, 100 + y / height * 55, 60];
    for (let c = 0; c < 3; c++) data[at + c] = Math.max(0, Math.min(255, color[c] + noise));
  }
  return sharp(data, { raw }).jpeg({ quality: 88 }).toBuffer();
}

export async function textPng() {
  // Bitmap glyphs avoid depending on installed fonts or writable font caches.
  const glyphs = {
    "0": ["11111","10001","10001","10001","10001","10001","11111"],
    "2": ["11111","00001","00001","11111","10000","10000","11111"],
    "3": ["11111","00001","00001","11111","00001","00001","11111"],
    "4": ["10001","10001","10001","11111","00001","00001","00001"],
    "6": ["11111","10000","10000","11111","10001","10001","11111"],
    P: ["11111","10001","10001","11111","10000","10000","10000"],
    R: ["11110","10001","10001","11110","10100","10010","10001"],
    O: ["11111","10001","10001","10001","10001","10001","11111"],
    J: ["11111","00001","00001","00001","10001","10001","11111"],
    E: ["11111","10000","10000","11111","10000","10000","11111"],
    C: ["11111","10000","10000","10000","10000","10000","11111"],
    T: ["11111","00100","00100","00100","00100","00100","00100"],
    Q: ["11111","10001","10001","10001","10101","10010","11101"],
  };
  const rows = Array.from({ length: 15 }, (_, line) => [..."203 PROJECT 2026 Q4"].flatMap((char, x) => (glyphs[char] ?? []).flatMap((row, y) => [...row].flatMap((pixel, col) => pixel === "1" ? [`<rect x="${70 + x * 42 + col * 6}" y="${40 + line * 65 + y * 6}" width="6" height="6" fill="#203040"/>`] : []))).join("")).join("");
  return sharp(Buffer.from(`<svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg"><rect width="1920" height="1080" fill="#fff"/>${rows}</svg>`)).png().toBuffer();
}

export async function transparentPng() {
  const width = 600, height = 400, data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    data[i] = 40; data[i + 1] = 100; data[i + 2] = 190;
    data[i + 3] = x < 200 ? 0 : x < 400 ? 128 : 255;
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}
