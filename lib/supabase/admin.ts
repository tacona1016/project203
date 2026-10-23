import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) return null;
  try { if (!["https:", "http:"].includes(new URL(url).protocol)) return null; }
  catch { return null; }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: init?.signal ?? AbortSignal.timeout(10_000) }) },
  });
}
