// Server-owned allowlist. URL parameters are image keys, never filesystem paths.
export const SITE_IMAGES = {
  homeHero: "home/hero.jpg",
  homeBackground: "home/background.jpg",
  boardBanner: "board/banner.jpg",
  sharedLandscape: "shared/landscape.jpg",
} as const;
export type SiteImageKey = keyof typeof SITE_IMAGES;
export function siteImagePath(key: string): string | null {
  if (!Object.hasOwn(SITE_IMAGES, key)) return null;
  const value = SITE_IMAGES[key as SiteImageKey];
  return /^(home|board|shared)\/[A-Za-z0-9][A-Za-z0-9._-]*\.(jpg|jpeg|png|webp|avif)$/.test(value) && !value.includes("..") ? value : null;
}
export function siteImageContentType(file: string, bytes: Uint8Array): string | null {
  const data = Buffer.from(bytes);
  if (/\.jpe?g$/.test(file) && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (file.endsWith(".png") && data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (file.endsWith(".webp") && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (file.endsWith(".avif") && data.toString("ascii", 4, 8) === "ftyp" && ["avif", "avis"].includes(data.toString("ascii", 8, 12))) return "image/avif";
  return null;
}
