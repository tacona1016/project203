import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE, getAccessSession, requireAccessSession } from "./session";
import { adminSessionKey } from "./member-token";
import { signSession, verifySession } from "./token";
import { HttpError, requireApiSession } from "./http";

export const ADMIN_COOKIE = "project203_admin";
const ADMIN_DURATION = 60 * 60 * 8;
// Separate cryptographic purpose: a site token cannot verify as an admin token.
async function adminSigningKey() {
  return adminSessionKey(process.env.SITE_SESSION_SECRET ?? "", (await cookies()).get(ACCESS_COOKIE)?.value ?? "");
}
const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };

export function isAdminConfigured() { return !!process.env.ADMIN_PASSWORD?.trim() && Buffer.byteLength(process.env.SITE_SESSION_SECRET ?? "") >= 32; }
export async function getAdminSession() {
  if (!isAdminConfigured() || !await getAccessSession()) return null;
  return verifySession((await cookies()).get(ADMIN_COOKIE)?.value, await adminSigningKey(), undefined, ADMIN_DURATION);
}
export async function requireAdminSession() {
  await requireAccessSession("/admin");
  if (!await getAdminSession()) redirect("/admin");
}
export async function requireAdminApiSession() {
  await requireApiSession();
  if (!await getAdminSession()) throw new HttpError(403, "관리자 인증이 필요합니다.");
}
export async function createAdminSession() {
  await requireApiSession();
  const { token, expiresAt } = signSession(await adminSigningKey(), undefined, ADMIN_DURATION);
  (await cookies()).set(ADMIN_COOKIE, token, { ...options, maxAge: ADMIN_DURATION, expires: new Date(expiresAt * 1000) });
}
export async function clearAdminSession() {
  (await cookies()).set(ADMIN_COOKIE, "", { ...options, maxAge: 0, expires: new Date(0) });
}
