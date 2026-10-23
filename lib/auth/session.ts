import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_DURATION, signSession, verifySession } from "./token";

export const ACCESS_COOKIE = "project203_access";
const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };

export function isAccessConfigured() {
  return !!process.env.SITE_ACCESS_PASSWORD?.trim() && Buffer.byteLength(process.env.SITE_SESSION_SECRET ?? "") >= 32;
}

export function verifyAccessSession(token: string | undefined) {
  return verifySession(token, process.env.SITE_SESSION_SECRET ?? "");
}

export async function getAccessSession() {
  return verifyAccessSession((await cookies()).get(ACCESS_COOKIE)?.value);
}

export async function requireAccessSession(returnTo = "/") {
  const session = await getAccessSession();
  if (!session) redirect(`/access?next=${encodeURIComponent(safeReturnTo(returnTo))}`);
  return session;
}

export async function createAccessSession() {
  const { token, expiresAt } = signSession(process.env.SITE_SESSION_SECRET ?? "");
  (await cookies()).set(ACCESS_COOKIE, token, { ...cookieOptions, maxAge: SESSION_DURATION, expires: new Date(expiresAt * 1000) });
}

export async function clearAccessSession() {
  (await cookies()).set(ACCESS_COOKIE, "", { ...cookieOptions, maxAge: 0, expires: new Date(0) });
}

export function safeReturnTo(value: unknown) {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return "/";
  try {
    const url = new URL(value, "https://project203.invalid");
    const decoded = decodeURIComponent(url.pathname);
    if (url.origin !== "https://project203.invalid" || decoded.startsWith("//") || /[\\\u0000-\u0020]/.test(decoded)
      || /^\/(access|api|_next)(\/|$)/.test(decoded)) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return "/"; }
}
