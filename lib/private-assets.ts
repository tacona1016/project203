import "server-only";
import { open, realpath, type FileHandle } from "node:fs/promises";
import path from "node:path";
import { siteImageContentType, siteImagePath } from "./site-images-config";

const maximumBytes = 8 * 1024 * 1024;
async function openSiteImage(key: string) {
  const relative = siteImagePath(key);
  if (!relative) return null;
  let handle: FileHandle | undefined;
  try {
    const root = await realpath(path.join(process.cwd(), "private-assets/site"));
    const file = await realpath(path.join(root, relative));
    const inside = path.relative(root, file);
    if (!inside || inside.startsWith("..") || path.isAbsolute(inside)) return null;
    handle = await open(file, "r");
    const info = await handle.stat();
    if (!info.isFile() || info.size > maximumBytes) { await handle.close(); return null; }
    return { handle, size: info.size, relative };
  } catch { await handle?.close().catch(() => undefined); return null; }
}

async function readBytes(handle: FileHandle, length: number) {
  const bytes = Buffer.alloc(length);
  let offset = 0;
  while (offset < bytes.length) {
    const result = await handle.read(bytes, offset, bytes.length - offset, offset);
    if (!result.bytesRead) return null;
    offset += result.bytesRead;
  }
  return bytes;
}

// The server render only probes the same allowed file's signature (at most 12
// bytes). The authenticated Route Handler still validates and reads the body.
export async function hasSiteImage(key: string) {
  const file = await openSiteImage(key);
  if (!file) return false;
  try {
    const bytes = await readBytes(file.handle, Math.min(file.size, 12));
    return bytes !== null && siteImageContentType(file.relative, bytes) !== null;
  } catch { return false; }
  finally { await file.handle.close(); }
}

export async function readSiteImage(key: string) {
  const file = await openSiteImage(key);
  if (!file) return null;
  try {
    const bytes = await readBytes(file.handle, file.size);
    if (!bytes) return null;
    const type = siteImageContentType(file.relative, bytes);
    return type ? { bytes, type } : null;
  } catch { return null; }
  finally { await file.handle.close(); }
}
