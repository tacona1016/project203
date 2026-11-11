import type { ProjectStatus } from "../../data/project-status.ts";
import type { ProjectEvent } from "../../data/project-plan.ts";
import { projectEventHref } from "../../data/project-plan.ts";

export type ProjectKind = "status" | "event" | "decision";
export type ProjectEntry = {
  kind: ProjectKind; key: string; data: Record<string, unknown> | null;
  board_post_id: string | null; superseded_by: string | null; related_poll_slugs: string[];
  is_visible: boolean; deleted_at: string | null; version: number; updated_at: string;
};
export type ProjectRevision = { id: string; kind: ProjectKind; key: string; before_data: ProjectEntry | null; after_data: ProjectEntry; created_at: string };
export type ProjectAdminState = { configured: boolean; entries: ProjectEntry[]; revisions: ProjectRevision[];
  notices: { id: string; title: string }[]; polls: { slug: string; title: string; is_hidden: boolean }[] };
export type HomeNotice = { id: string | number; title: string; is_pinned: boolean; created_at: string };
export type HomeDecision = HomeNotice & { decidedOn?: string | null; pollsUnavailable: boolean; polls: { slug: string; title: string }[] };
export type ProjectHome = { source: "database" | "legacy" | "unavailable"; status: ProjectStatus | null;
  events: ProjectEvent[]; notices: HomeNotice[] | null; decisions: HomeDecision[] | null };

export class ProjectInputError extends Error {}
function invalid(message = "입력 내용을 확인해주세요."): never { throw new ProjectInputError(message); }
const object = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : invalid();
function keys(v: Record<string, unknown>, allowed: string[]) { if (Object.keys(v).some(k => !allowed.includes(k))) invalid(); }
function text(v: unknown, max: number, required = false) {
  if (v === undefined || v === null) return required ? invalid("필수 항목을 입력해주세요.") : "";
  if (typeof v !== "string" || Array.from(v.trim()).length > max) invalid("입력 길이를 확인해주세요.");
  if (required && !v.trim()) invalid("필수 항목을 입력해주세요.");
  return v.trim();
}
export function projectDate(v: unknown): string | null {
  if (v === "" || v === null || v === undefined) return null;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) invalid("기준일을 확인해주세요.");
  const d = new Date(`${v}T00:00:00Z`);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== v) invalid("기준일을 확인해주세요.");
  return v;
}
export function projectId(v: unknown): string {
  if (typeof v !== "string" || !/^[1-9]\d{0,18}$/.test(v) || BigInt(v) > BigInt("9223372036854775807")) invalid("공지 번호를 확인해주세요.");
  return v;
}
function href(v: unknown) { const raw = text(v, 2048); if (!raw) return null; return projectEventHref(raw) ?? invalid("프로젝트 내부 링크를 입력해주세요."); }
export function projectData(kind: ProjectKind, input: unknown): Record<string, unknown> | null {
  if (kind === "status" && input === null) return null;
  const d = object(input);
  if (kind === "status") {
    keys(d, ["phase", "goal", "nextAction", "updatedAt", "relatedLinks"]);
    if (d.relatedLinks !== undefined && (!Array.isArray(d.relatedLinks) || d.relatedLinks.length > 4)) invalid("관련 링크는 최대4개입니다.");
    return { phase: text(d.phase, 120, true), goal: text(d.goal, 1000) || null, nextAction: text(d.nextAction, 1000, true),
      updatedAt: projectDate(d.updatedAt) ?? invalid("기준일을 입력해주세요."),
      relatedLinks: (d.relatedLinks as unknown[] ?? []).map(v => { const l = object(v); keys(l, ["label", "href"]); return { label: text(l.label, 80, true), href: href(l.href) ?? invalid("링크를 입력해주세요.") }; }) };
  }
  if (typeof d.isVisible !== "boolean") invalid("표시 여부를 확인해주세요.");
  if (kind === "event") {
    keys(d, ["title", "startsAt", "location", "description", "href", "isVisible"]);
    const startsAt = text(d.startsAt, 40, true);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(startsAt) || !Number.isFinite(Date.parse(startsAt))) invalid("일정 날짜와 시간을 확인해주세요.");
    projectDate(startsAt.slice(0, 10));
    return { title: text(d.title, 160, true), startsAt: new Date(startsAt).toISOString(), location: text(d.location, 240),
      description: text(d.description, 2000), href: href(d.href), isVisible: d.isVisible };
  }
  keys(d, ["decidedOn", "relatedPollSlugs", "isVisible", "supersededBy"]);
  if (!Array.isArray(d.relatedPollSlugs) || d.relatedPollSlugs.length > 20
    || d.relatedPollSlugs.some(v => typeof v !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) || v.length > 100)) invalid("관련 투표를 확인해주세요.");
  return { decidedOn: projectDate(d.decidedOn), relatedPollSlugs: [...new Set(d.relatedPollSlugs)], isVisible: d.isVisible,
    supersededBy: d.supersededBy === "" || d.supersededBy == null ? null : projectId(d.supersededBy) };
}
export function parseProjectCommand(input: unknown) {
  const d = object(input); keys(d, ["kind", "action", "id", "version", "data", "historyId"]);
  if (!["status", "event", "decision"].includes(String(d.kind)) || !["save", "delete", "restore"].includes(String(d.action))) invalid();
  const kind = d.kind as ProjectKind, action = d.action as "save" | "delete" | "restore";
  if (!Number.isSafeInteger(d.version) || Number(d.version) < 0 || Number(d.version) > 2147483646) invalid("현재 버전을 확인해주세요.");
  const id = kind === "status" ? "current" : kind === "decision" ? projectId(d.id)
    : d.id == null ? null : typeof d.id === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(d.id) ? d.id : invalid("일정 번호를 확인해주세요.");
  if (action === "delete" && (kind !== "event" || !id)) invalid("일정만 삭제할 수 있습니다. 결정은 숨김 또는 대체 처리해주세요.");
  if (action === "restore" && !id) invalid();
  const data = action === "save" ? projectData(kind, d.data) : null;
  return { kind, action, id, version: Number(d.version), data, historyId: action === "restore" ? projectId(d.historyId) : null };
}

export function missingProjectSchema(error: { code?: string; message?: string } | null): boolean {
  return !!error && ["PGRST202", "42883"].includes(error.code ?? "") && /get_project_home|get_project_admin|change_project_entry/.test(error.message ?? "");
}
