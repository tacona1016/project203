import "server-only";
import { cache } from "react";
import { protectedClient } from "@/lib/site-data";
import { requireAdminApiSession } from "@/lib/auth/admin-session";
import { requireApiSession, HttpError } from "@/lib/auth/http";
import { projectStatus } from "@/data/project-status";
import { getUpcomingProjectEvents } from "@/data/project-plan";
import { contentLinks, validContentLinks } from "@/data/content-links";
import { quarters } from "@/data/quarters";
import { homeDecisionIds } from "@/lib/home-decisions";
import { getHomeDecisionNotices, getLatestBoardNotices } from "@/lib/board/notices";
import { missingProjectSchema, parseProjectCommand, ProjectInputError, type ProjectAdminState, type ProjectHome } from "./model";
import { randomUUID } from "node:crypto";

// React cache is per server render/request, never a cross-member shared cache.
export const getProjectHome = cache(async (): Promise<ProjectHome> => {
  const client = await protectedClient();
  const result = await client.rpc("get_project_home", {}).retry(false);
  if (!result.error && result.data) return { ...result.data, source: "database",
    status: result.data.statusConfigured ? result.data.status : projectStatus };
  if (!missingProjectSchema(result.error)) return { source: "unavailable", status: null, events: [], decisions: null, notices: null };
  const ids = homeDecisionIds(validContentLinks(contentLinks, quarters));
  // Exclude every registered decision before LIMIT, rather than filtering three rows afterward.
  const [notices, decisions] = await Promise.allSettled([getLatestBoardNotices(ids), getHomeDecisionNotices()]);
  return { source: "legacy", status: projectStatus, events: getUpcomingProjectEvents(),
    notices: notices.status === "fulfilled" ? notices.value : null,
    decisions: decisions.status === "fulfilled" ? decisions.value : null };
});

export async function getProjectAdmin(): Promise<ProjectAdminState> {
  await requireAdminApiSession();
  const result = await (await protectedClient()).rpc("get_project_admin", {}).retry(false);
  if (missingProjectSchema(result.error)) return { configured: false, entries: [], revisions: [], notices: [], polls: [] };
  if (result.error || !result.data) throw new HttpError(503, "관리 정보를 불러오지 못했습니다. 잠시 후 다시 확인해주세요.");
  return result.data;
}

export async function changeProjectEntry(body: unknown) {
  await requireAdminApiSession();
  const session = await requireApiSession();
  let command;
  try { command = parseProjectCommand(body); }
  catch (error) { if (error instanceof ProjectInputError) throw new HttpError(400, error.message); throw error; }
  const result = await (await protectedClient()).rpc("change_project_entry", { p_actor_id: session.participant.id,
    p_kind: command.kind, p_key: command.id ?? randomUUID(), p_action: command.action, p_version: command.version,
    p_data: command.data, p_history_id: command.historyId }).retry(false);
  if (missingProjectSchema(result.error)) throw new HttpError(503, "프로젝트 관리 DB 적용이 필요합니다. 기존 HOME은 파일 설정으로 동작합니다.");
  if (result.error?.code === "P4090") throw new HttpError(409, "다른 창에서 변경되었습니다. 최신 정보를 불러온 뒤 다시 저장해주세요.");
  if (result.error?.code === "P4040") throw new HttpError(404, "등록된 공지나 변경 기록을 찾을 수 없습니다.");
  if (["22023", "22007", "22008", "23514", "23503"].includes(result.error?.code ?? "")) throw new HttpError(400, "입력값과 실제 공지·투표·후속 결정의 연결을 확인해주세요.");
  if (result.error || !result.data) throw new HttpError(503, "저장 여부를 확인하지 못했습니다. 최신 정보를 조회한 후 다시 시도해주세요.");
  return result.data;
}
