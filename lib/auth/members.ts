import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { configuredMemberPassword, credentialIssue } from "./credentials";
import { passwordsMatch } from "./token";

export type LoginMember = { id: string; display_name: string };
export async function getLoginMembers(): Promise<LoginMember[]> {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error("Member directory unavailable.");
  const { data, error } = await client.from("participants").select("id,display_name")
    .eq("is_active", true).order("display_order").order("display_name");
  if (error) throw new Error("Member directory unavailable.");
  return data;
}
export async function authenticateMember(id: unknown, input: unknown) {
  const validId = typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const raw = process.env.BOARD_PARTICIPANT_PASSWORDS;
  const issue = validId ? credentialIssue(raw, id) : "invalid_input";
  const expected = validId ? configuredMemberPassword(raw, id) : null;
  const matches = passwordsMatch(typeof input === "string" ? input : "", expected ?? "unconfigured-member");
  let member: LoginMember | undefined;
  try { member = (await getLoginMembers()).find((item) => item.id === id); }
  catch { console.warn("[member-auth] directory_unavailable"); return null; }
  const secretValid = Buffer.byteLength(process.env.SITE_SESSION_SECRET ?? "") >= 32;
  if (!expected || !matches || !member || typeof input !== "string" || input.length > 1024 || !secretValid) {
    // Never log submitted IDs, credentials, tokens or upstream errors.
    console.warn(`[member-auth] ${!secretValid ? "session_configuration" : issue ?? (!member ? "inactive_or_unknown_member" : "invalid_credentials")}`);
    return null;
  }
  return member;
}
