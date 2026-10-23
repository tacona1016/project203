import "server-only";
import { requireAccessSession } from "@/lib/auth/session";
import { getSupabaseAdminClient } from "./admin";

export async function getSupabaseServerClient() {
  await requireAccessSession();
  return getSupabaseAdminClient();
}
