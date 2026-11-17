import { HttpError, uuid } from "@/lib/auth/http";
import { noBoardQuery } from "@/lib/board/feature-http";
import { readPollImage } from "@/lib/poll-images/data";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" };
type Context = { params: Promise<{ slug: string; imageId: string }> };
export async function GET(request: Request, { params }: Context) {
  try {
    noBoardQuery(request); const p = await params;
    const bytes = await readPollImage(p.slug, uuid(p.imageId));
    return new Response(bytes, { headers: { ...headers, "Content-Type": "image/webp", "Content-Length": String(bytes.length) } });
  } catch (error) { return new Response(null, { status: error instanceof HttpError ? error.status : 503, headers }); }
}
export async function HEAD(request: Request, context: Context) { const r = await GET(request, context); return new Response(null, { status: r.status, headers: r.headers }); }
