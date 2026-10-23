import "server-only";
import { open, realpath } from "node:fs/promises";
import path from "node:path";
import { siteImageContentType, siteImagePath } from "./site-images-config";

const maximumBytes = 8 * 1024 * 1024;
export async function readSiteImage(key: string) {
  const relative = siteImagePath(key);
  if (!relative) return null;
  try {
    const root = await realpath(path.join(process.cwd(), "private-assets/site"));
    const file = await realpath(path.join(root, relative));
    const inside = path.relative(root, file);
    if (!inside || inside.startsWith("..") || path.isAbsolute(inside)) return null;
    const handle = await open(file, "r");
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.size > maximumBytes) return null;
      const bytes = Buffer.alloc(info.size);
      let offset = 0;
      while (offset < bytes.length) {
        const result = await handle.read(bytes, offset, bytes.length - offset, offset);
        if (!result.bytesRead) return null;
        offset += result.bytesRead;
      }
      const type = siteImageContentType(relative, bytes);
      return type ? { bytes, type } : null;
    } finally { await handle.close(); }
  } catch { return null; }
}
