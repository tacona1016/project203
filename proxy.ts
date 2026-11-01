import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, verifyAccessSession } from "@/lib/auth/session";
import { AUTH_SERVICE_MESSAGE, AuthServiceError, authServiceHeaders, serviceUnavailableHtml } from "@/lib/auth/service-error";
import { isPresentationPublished } from "@/data/quarters";
import { getLoginMembers } from "@/lib/auth/members";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/_next/static/") || pathname === "/_next/webpack-hmr" || ["/favicon.ico", "/icon.svg"].includes(pathname)) return NextResponse.next();
  const publicRoute = ["/access", "/api/access", "/api/access/participants"].includes(pathname);
  let response: NextResponse;
  try {
    // A public login page still needs its directory; fail with an HTTP 503 before rendering.
    if (pathname === "/access") await getLoginMembers();
    const session = publicRoute ? null : await verifyAccessSession(request.cookies.get(ACCESS_COOKIE)?.value);
    if (publicRoute || session) {
      const presentation = pathname.match(/^\/quarter\/([^/]+)(?:\/|$)/);
      let published = true;
      if (presentation) {
        try { published = isPresentationPublished(decodeURIComponent(presentation[1])); }
        catch { published = false; }
      }
      response = published ? NextResponse.next() : new NextResponse("페이지를 찾을 수 없습니다.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    } else if (pathname.startsWith("/api/")) {
      response = NextResponse.json({ error: "회원 로그인이 필요합니다." }, { status: 401 });
    } else {
      const url = new URL("/access", request.url);
      url.searchParams.set("next", pathname + request.nextUrl.search);
      response = NextResponse.redirect(url);
    }
  } catch (error) {
    if (!(error instanceof AuthServiceError)) console.warn("[member-auth] service_internal");
    // No protected content, redirect, or cookie mutation while membership is unknown.
    response = pathname.startsWith("/api/")
      ? NextResponse.json({ error: AUTH_SERVICE_MESSAGE, code: "service_unavailable" }, { status: 503, headers: authServiceHeaders })
      : new NextResponse(serviceUnavailableHtml(), { status: 503, headers: { ...authServiceHeaders, "Content-Type": "text/html; charset=utf-8" } });
  }
  // Private HTML, RSC, optimized images and API responses must never enter a shared cache.
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Referrer-Policy", "same-origin");
  return response;
}

export const config = { matcher: ["/:path*"] };
