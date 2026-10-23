import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, verifyAccessSession } from "@/lib/auth/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/_next/static/") || pathname === "/_next/webpack-hmr" || ["/favicon.ico", "/icon.svg"].includes(pathname)) return NextResponse.next();
  const publicRoute = pathname === "/access" || pathname === "/api/access";
  const session = verifyAccessSession(request.cookies.get(ACCESS_COOKIE)?.value);
  let response: NextResponse;
  if (publicRoute || session) {
    response = NextResponse.next();
  } else if (pathname.startsWith("/api/")) {
    response = NextResponse.json({ error: "사이트 비밀번호 인증이 필요합니다." }, { status: 401 });
  } else {
    const url = new URL("/access", request.url);
    url.searchParams.set("next", pathname + request.nextUrl.search);
    response = NextResponse.redirect(url);
  }
  // Private HTML, RSC, optimized images and API responses must never enter a shared cache.
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Referrer-Policy", "same-origin");
  return response;
}

export const config = { matcher: ["/:path*"] };
