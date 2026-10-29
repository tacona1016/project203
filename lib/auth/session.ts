import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { SESSION_DURATION } from "./token";
import { createMemberToken, verifyMemberToken } from "./member-token";
import { configuredMemberPassword } from "./credentials";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const ACCESS_COOKIE = "project203_member";
const legacyCookies = ["project203_access", "project203_board", "project203_participant_selection", "project203_admin"];
const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };

export async function verifyAccessSession(token: string | undefined) {
  const claims = verifyMemberToken(token, process.env.SITE_SESSION_SECRET ?? "", process.env.BOARD_PARTICIPANT_PASSWORDS);
  if (!claims) return null;
  const client = getSupabaseAdminClient();
  if (!client) return null;
  try {
    const { data, error } = await client.from("participants").select("id,display_name")
      .eq("id", claims.participantId).eq("is_active", true).maybeSingle();
    if (error) { console.warn("[member-auth] participant_lookup_failed"); return null; }
    return data ? { ...claims, participant: data } : null;
  } catch { console.warn("[member-auth] participant_lookup_failed"); return null; }
}

// Only deduplicate within one server render/request; never cache member validity globally.
export const getAccessSession = cache(async () => {
  return verifyAccessSession((await cookies()).get(ACCESS_COOKIE)?.value);
});

export async function requireAccessSession(returnTo = "/") {
  const session = await getAccessSession();
  if (!session) redirect(`/access?next=${encodeURIComponent(safeReturnTo(returnTo))}`);
  return session;
}

export async function createAccessSession(participantId: string) {
  const password = configuredMemberPassword(process.env.BOARD_PARTICIPANT_PASSWORDS, participantId);
  if (!password) throw new Error("Member configuration unavailable.");
  const { token, expiresAt } = createMemberToken(process.env.SITE_SESSION_SECRET ?? "", participantId, password);
  await clearAccessSession();
  (await cookies()).set(ACCESS_COOKIE, token, { ...cookieOptions, maxAge: SESSION_DURATION, expires: new Date(expiresAt * 1000) });
}

export async function clearAccessSession() {
  const jar = await cookies();
  for (const name of [ACCESS_COOKIE, ...legacyCookies]) jar.set(name, "", { ...cookieOptions, maxAge: 0, expires: new Date(0) });
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
