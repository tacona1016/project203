import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;

  try {
    if (!["http:", "https:"].includes(new URL(url).protocol)) return null;
    return { url, key };
  } catch {
    return null;
  }
}

export function createPublicClient(config: { url: string; key: string }) {
  return createClient<Database>(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => fetch(input, {
        ...init,
        cache: "no-store",
        signal: init?.signal ?? AbortSignal.timeout(10_000),
      }),
    },
  });
}
