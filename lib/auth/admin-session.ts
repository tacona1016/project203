import "server-only";
import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAccessSession, requireAccessSession } from "./session";
import { signSession, verifySession } from "./token";
import { HttpError, requireApiSession } from "./http";

export const ADMIN_COOKIE = "project203_admin";
const ADMIN_DURATION = 60 * 60 * 8;
// Separate cryptographic purpose: a site token cannot verify as an admin token.
function adminSigningKey() {
  const secret = process.env.SITE_SESSION_SECRET ?? "";
  return Buffer.byteLength(secret) >= 32 ? createHmac("sha256", secret).update("203-project:admin-session:v1").digest("hex") : "";
}
const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };

export function isAdminConfigured() { return !!process.env.ADMIN_PASSWORD?.trim() && !!adminSigningKey(); }
export async function getAdminSession() {
  if (!isAdminConfigured() || !await getAccessSession()) return null;
  return verifySession((await cookies()).get(ADMIN_COOKIE)?.value, adminSigningKey(), undefined, ADMIN_DURATION);
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
  const { token, expiresAt } = signSession(adminSigningKey(), undefined, ADMIN_DURATION);
  (await cookies()).set(ADMIN_COOKIE, token, { ...options, maxAge: ADMIN_DURATION, expires: new Date(expiresAt * 1000) });
}
export async function clearAdminSession() {
  (await cookies()).set(ADMIN_COOKIE, "", { ...options, maxAge: 0, expires: new Date(0) });
}
