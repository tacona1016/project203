import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { HttpError, requireApiSession } from "@/lib/auth/http";
import { quarters } from "@/data/quarters";

export async function protectedClient() {
  await requireApiSession();
  const client = getSupabaseAdminClient();
  if (!client) throw new HttpError(503, "데이터 연결을 준비하고 있습니다. 잠시 후 다시 시도해주세요.");
  return client;
}

export function pollSlug(value: unknown): string {
  if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length > 100) throw new HttpError(400, "투표 정보를 확인해주세요.");
  return value;
}

export function quarterSlug(value: unknown): string {
  if (typeof value !== "string" || !quarters.some((quarter) => quarter.slug === value)) throw new HttpError(400, "분기 정보를 확인해주세요.");
  return value;
}
