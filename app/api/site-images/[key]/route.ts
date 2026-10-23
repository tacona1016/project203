import { requireApiSession, HttpError } from "@/lib/auth/http";
import { readSiteImage } from "@/lib/private-assets";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" };
export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    await requireApiSession();
    const image = await readSiteImage((await params).key);
    if (!image) return new Response(null, { status: 404, headers });
    return new Response(new Uint8Array(image.bytes), { headers: { ...headers, "Content-Type": image.type, "Content-Length": String(image.bytes.length) } });
  } catch (error) { return new Response(null, { status: error instanceof HttpError ? error.status : 503, headers }); }
}
export async function HEAD(request: Request, context: { params: Promise<{ key: string }> }) {
  const response = await GET(request, context);
  return new Response(null, { status: response.status, headers: response.headers });
}
