import "server-only";
import { protectedClient } from "@/lib/site-data";
import { requireAdminApiSession } from "@/lib/auth/admin-session";
import { HttpError } from "@/lib/auth/http";
import { parsePollInput } from "@/lib/polls";
import { quarters } from "@/data/quarters";

export async function adminClient() {
  await requireAdminApiSession();
  return protectedClient();
}

export function adminPollInput(body: Record<string, unknown>, creating: boolean) {
  try { return parsePollInput(body, creating, quarters); }
  catch (error) { throw new HttpError(400, error instanceof Error ? error.message : "입력 내용을 확인해주세요."); }
}

export function checkAdminResult<T>(result: { data: T | null; error: { code?: string } | null }) {
  if (result.error?.code === "P2031") throw new HttpError(409, "이미 투표가 존재하는 Poll은 분기를 변경할 수 없습니다.");
  if (result.error?.code === "P2032") throw new HttpError(409, "응답이 있는 Poll은 유형·투표 방식·선택지를 변경할 수 없습니다.");
  if (result.error?.code === "P2033") throw new HttpError(400, "기존 응답보다 최대 글자 수를 짧게 설정할 수 없습니다.");
  if (result.error?.code === "22023") throw new HttpError(400, "유형·선택지·글자 수·투표 기간 설정을 확인해주세요.");
  if (result.error || result.data === null) throw new HttpError(503, "저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
  return result.data;
}
