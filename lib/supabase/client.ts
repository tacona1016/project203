"use client";

import { createPublicClient, getSupabaseConfig } from "./config";

let client: ReturnType<typeof createPublicClient> | undefined;

export function getSupabaseClient() {
  const config = getSupabaseConfig();
  if (!config) return null;
  client ??= createPublicClient(config);
  return client;
}
