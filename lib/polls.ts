import type { PollRecord, PollInput, PollSummary } from "./supabase/types";

export const POLL_STATUS_LABELS = { ACTIVE: "진행 중", UPCOMING: "투표 예정", CLOSED: "투표 종료", HIDDEN: "숨김" };

// Display the canonical slug without bundling the private presentation registry.
// Membership validation always uses data/quarters.ts on the server.
export function formatPollQuarter(slug: string) {
  return /^\d{4}-q[1-4]$/.test(slug) ? slug.replace("-q", " Q") : slug;
}

export function formatKoreanDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
}

export function votingPeriod(poll: Pick<PollRecord, "voting_starts_at" | "voting_ends_at">) {
  if (!poll.voting_starts_at && !poll.voting_ends_at) return "상시 투표";
  return `${poll.voting_starts_at ? formatKoreanDate(poll.voting_starts_at) : "시작 제한 없음"} → ${poll.voting_ends_at ? formatKoreanDate(poll.voting_ends_at) : "마감 없음"} (한국 시간)`;
}

export function toSeoulInput(value: string | null) {
  if (!value) return "";
  return new Date(new Date(value).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

export function fromSeoulInput(value: unknown): string | null {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("날짜와 시간을 확인해주세요.");
  const date = new Date(value + ":00+09:00");
  if (!Number.isFinite(date.getTime()) || toSeoulInput(date.toISOString()) !== value) throw new Error("올바른 날짜와 시간을 입력해주세요.");
  return date.toISOString();
}

// Shared validation is repeated on the server before the transactional RPC.
export function parsePollInput(value: Record<string, unknown>, creating: boolean, registeredQuarters: readonly { slug: string }[]): PollInput {
  if (typeof value.quarter !== "string" || !registeredQuarters.some((quarter) => quarter.slug === value.quarter)) throw new Error("등록된 분기를 선택해주세요.");
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const description = typeof value.description === "string" ? value.description.trim() : "";
  if (!title || title.length > 160 || description.length > 2000) throw new Error("제목은 1~160자, 설명은 2000자 이내로 작성해주세요.");
  if (value.poll_type !== "choice" && value.poll_type !== "text") throw new Error("객관식 또는 주관식을 선택해주세요.");
  if (value.results_visibility !== "live" && value.results_visibility !== "after_close") throw new Error("결과 공개 시점을 선택해주세요.");
  const textMaxLength = value.text_max_length;
  if (!Number.isInteger(textMaxLength) || Number(textMaxLength) < 10 || Number(textMaxLength) > 5000) throw new Error("최대 응답 길이는 10~5000자 사이의 정수로 입력해주세요.");
  if (value.vote_mode !== "single" && value.vote_mode !== "multiple") throw new Error("투표 방식을 선택해주세요.");
  if (typeof value.allow_vote_change !== "boolean" || typeof value.is_hidden !== "boolean" || typeof value.scheduled !== "boolean") throw new Error("투표 설정을 확인해주세요.");
  const start = value.scheduled ? fromSeoulInput(value.start) : null;
  const end = value.scheduled ? fromSeoulInput(value.end) : null;
  if (value.scheduled && (!start || !end || end <= start)) throw new Error("종료 시간은 시작 시간보다 늦어야 합니다.");
  const options = Array.isArray(value.options) ? value.options.map((item) => typeof item === "string" ? item.trim() : "") : [];
  // On edit, options are required only if the server finds zero existing votes.
  if (value.poll_type === "choice" && (creating || options.length > 0) && (options.length < 2 || options.length > 20 || options.some((item) => !item || Array.from(item).length > 100))) throw new Error("선택지는 2~20개, 각 1~100자로 입력해주세요.");
  return { quarter: value.quarter, title, description, poll_type: value.poll_type, results_visibility: value.results_visibility, text_max_length: Number(textMaxLength),
    vote_mode: value.poll_type === "text" ? "single" : value.vote_mode, allow_vote_change: (value.poll_type === "text" || value.vote_mode === "single") && value.allow_vote_change,
    voting_starts_at: start, voting_ends_at: end, is_hidden: value.is_hidden, options: value.poll_type === "choice" ? options : [] };
}

export function canShowPollResults(poll: Pick<PollRecord, "results_visibility">, status: PollSummary["status"]) {
  return status !== "HIDDEN" && (poll.results_visibility === "live" || status === "CLOSED");
}

export function validateTextResponse(value: unknown, maximum: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error("응답 내용을 입력해주세요.");
  if (Array.from(text).length > maximum) throw new Error(`응답은 ${maximum}자 이내로 작성해주세요.`);
  return text;
}

// Quarter only classifies polls. The database clock and poll settings determine status.
export function getQuarterPolls(catalog: readonly PollSummary[], quarter: string): PollSummary[] {
  const rank = { ACTIVE: 0, UPCOMING: 1, CLOSED: 2, HIDDEN: 3 };
  return catalog.filter((item) => item.poll.quarter === quarter).sort((a, b) =>
    rank[a.status] - rank[b.status] || b.poll.created_at.localeCompare(a.poll.created_at) || String(b.poll.id).localeCompare(String(a.poll.id)),
  );
}

export function getPollCounts(items: readonly PollSummary[]) {
  return {
    total: items.length,
    active: items.filter((item) => item.status === "ACTIVE").length,
    upcoming: items.filter((item) => item.status === "UPCOMING").length,
    closed: items.filter((item) => item.status === "CLOSED").length,
    hidden: items.filter((item) => item.status === "HIDDEN").length,
  };
}
