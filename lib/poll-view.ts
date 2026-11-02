import type { PollOption, PollRecord, PollResultsData, PollSummary } from "./supabase/types";

export type PollStatusFilter = "active" | "upcoming" | "closed" | "all";
export type PollParticipationFilter = "all" | "pending" | "done";
export type PollView = { status: PollStatusFilter; participation: PollParticipationFilter };

export function parsePollView(query: { status?: unknown; tab?: unknown; participation?: unknown }): PollView {
  const status = typeof query.status === "string" && ["active", "upcoming", "closed", "all"].includes(query.status)
    ? query.status as PollStatusFilter : query.tab === "closed" ? "closed" : "active";
  const participation = query.participation === "pending" || query.participation === "done" ? query.participation : "all";
  return { status, participation };
}

export function matchesPollView(summary: PollSummary, view: PollView) {
  if (summary.status === "HIDDEN" || (view.status !== "all" && summary.status.toLowerCase() !== view.status)) return false;
  if (view.participation === "pending") return summary.ownParticipation?.hasParticipated === false;
  if (view.participation === "done") return summary.ownParticipation?.hasParticipated === true;
  return true;
}

export function pollViewHref(href: string, view: PollView) {
  const query = new URLSearchParams();
  if (view.status !== "active") query.set("status", view.status);
  if (view.participation !== "all") query.set("participation", view.participation);
  return query.size ? `${href}?${query}` : href;
}

export function choiceResultRows(options: readonly PollOption[], results: PollResultsData, multiple: boolean, order: "options" | "votes") {
  const maximum = Math.max(0, ...options.map(option => results.counts[option.id] ?? 0));
  const tied = maximum > 0 && options.filter(option => (results.counts[option.id] ?? 0) === maximum).length > 1;
  const denominator = multiple ? results.participant_count : results.total_votes;
  const rows = options.map((option, index) => {
    const count = results.counts[option.id] ?? 0;
    return { option, count, percentage: denominator > 0 ? Math.round(count / denominator * 100) : 0,
      leader: maximum > 0 && count === maximum ? tied ? "공동 1위" : "1위" : null, index };
  });
  return order === "votes" ? rows.sort((a, b) => b.count - a.count || a.index - b.index) : rows;
}

export function participationRate(participants: number, eligible: number | undefined) {
  return typeof eligible === "number" && eligible > 0 && eligible >= participants
    ? Math.round(participants / eligible * 100) : null;
}

// Uses the database timestamp supplied with the Poll, not the device clock.
// This text is advisory; the existing database RPC remains the voting authority.
export function pollDeadline(poll: Pick<PollRecord, "voting_starts_at" | "voting_ends_at">, status: PollSummary["status"], now: string) {
  const boundary = status === "ACTIVE" ? poll.voting_ends_at : status === "UPCOMING" ? poll.voting_starts_at : null;
  if (!boundary) return null;
  const remaining = new Date(boundary).getTime() - new Date(now).getTime();
  if (!Number.isFinite(remaining)) return null;
  if (remaining <= 0) return status === "ACTIVE" ? "마감 시각이 지났습니다. 최신 상태를 확인해주세요." : "시작 시각이 되었습니다. 최신 상태를 확인해주세요.";
  const minutes = Math.max(1, Math.ceil(remaining / 60_000));
  const prefix = status === "ACTIVE" ? "마감까지" : "시작까지";
  if (minutes >= 1440) return `${prefix} ${Math.floor(minutes / 1440)}일 ${Math.floor(minutes % 1440 / 60)}시간`;
  if (minutes >= 60) return `${prefix} ${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
  return `${prefix} 약 ${minutes}분`;
}
