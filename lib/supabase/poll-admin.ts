import "server-only";
import { protectedClient } from "@/lib/site-data";
import { requireAdminApiSession } from "@/lib/auth/admin-session";
import { HttpError } from "@/lib/auth/http";
import { parsePollInput } from "@/lib/polls";
import { quarters } from "@/data/quarters";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import type { ChoiceLimit } from "@/lib/poll-choice-limit";

export async function adminClient() {
  await requireAdminApiSession();
  return protectedClient();
}

export function adminPollInput(body: Record<string, unknown>, creating: boolean) {
  try { return parsePollInput(body, creating, quarters); }
  catch (error) { throw new HttpError(400, error instanceof Error ? error.message : "입력 내용을 확인해주세요."); }
}

// Old DBs accept unknown JSON fields. Fail closed rather than silently create
// an unlimited poll when the administrator explicitly requested a limit.
export async function requireChoiceLimitSchema(client: SupabaseClient<Database>, limit: ChoiceLimit) {
  if (limit === null) return;
  const { error } = await client.from("polls").select("max_choices_per_participant").limit(0).retry(false);
  if (error) throw new HttpError(503, ["42703", "PGRST204"].includes(error.code)
    ? "최대 선택 개수 기능의 DB 적용이 필요합니다. 설정은 저장되지 않았습니다."
    : "투표 설정을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.");
}

export function checkAdminResult<T>(result: { data: T | null; error: { code?: string } | null }) {
  if (result.error?.code === "P2035") throw new HttpError(409, "이미 참여 기록이 있어 최대 선택 개수를 변경할 수 없습니다.");
  if (result.error?.code === "P2031") throw new HttpError(409, "이미 투표가 존재하는 Poll은 분기를 변경할 수 없습니다.");
  if (result.error?.code === "P2032") throw new HttpError(409, "응답이 있는 Poll은 유형·투표 방식·선택지를 변경할 수 없습니다.");
  if (result.error?.code === "P2033") throw new HttpError(400, "기존 응답보다 최대 글자 수를 짧게 설정할 수 없습니다.");
  if (result.error?.code === "22023") throw new HttpError(400, "유형·선택지·글자 수·투표 기간 설정을 확인해주세요.");
  if (result.error?.code === "23514") throw new HttpError(400, "최대 선택 개수와 실제 선택지 수 등 투표 설정을 확인해주세요.");
  if (result.error || result.data === null) throw new HttpError(503, "저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
  return result.data;
}
