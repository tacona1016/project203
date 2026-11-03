import { databaseId, handleApi, HttpError, requireApiSession, uuid } from "@/lib/auth/http";
import { AuthServiceError, authServiceHeaders } from "@/lib/auth/service-error";
import { deleteBoardImage, readBoardImage } from "@/lib/board/image-data";
import { emptyBoardMutation, noBoardQuery } from "@/lib/board/feature-http";
export const runtime = "nodejs";
export const maxDuration = 60;
type Context = { params: Promise<{ id: string; imageId: string }> };
const headers = { "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" };
export async function GET(request: Request, { params }: Context) {
  try {
    await requireApiSession(); noBoardQuery(request); const p = await params;
    const bytes = await readBoardImage(databaseId(p.id), uuid(p.imageId));
    return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": "image/webp", "Content-Length": String(bytes.length), "Content-Disposition": "inline" } });
  } catch (error) {
    return new Response(null, { status: error instanceof HttpError ? error.status : 503, headers: error instanceof AuthServiceError ? { ...headers, ...authServiceHeaders } : headers });
  }
}
export async function HEAD(request: Request, context: Context) { const r = await GET(request, context); return new Response(null, { status: r.status, headers: r.headers }); }
export async function DELETE(request: Request, { params }: Context) {
  return handleApi(async () => { await requireApiSession(); await emptyBoardMutation(request); const p = await params; return deleteBoardImage(databaseId(p.id), uuid(p.imageId)); });
}
