"use client";

import type { Comment, PollData, PollOutcome, VoteStatus, DatabaseId, PollParticipation } from "@/lib/supabase/types";

export const COMMENTS_PAGE_SIZE = 20;

export class SiteApiError extends Error {
  readonly status?: number;
  readonly uncertain: boolean;
  constructor(message: string, { status, uncertain = false }: { status?: number; uncertain?: boolean } = {}) {
    super(message);
    this.name = "SiteApiError";
    this.status = status;
    this.uncertain = uncertain;
  }
}

async function request<T>(url: string, body?: unknown): Promise<T> {
  const mutation = body !== undefined;
  let response: Response;
  try {
    response = await fetch(url, {
      method: mutation ? "POST" : "GET", credentials: "same-origin", cache: "no-store",
      ...(mutation ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
  } catch {
    // A lost response does not prove that the server rolled back the submission.
    throw new SiteApiError(mutation ? "등록 여부를 확인하지 못했습니다. 저장된 내역을 확인해주세요." : "일시적인 연결 문제가 발생했습니다. 잠시 후 다시 시도해주세요.", { uncertain: mutation });
  }
  if (response.status === 401) {
    const returnTo = window.location.pathname + window.location.search;
    window.location.replace(`/access?next=${encodeURIComponent(returnTo)}`);
    throw new SiteApiError("회원 로그인이 필요합니다.", { status: 401 });
  }
  let result;
  const uncertain = mutation && (response.status >= 500 || response.status === 408);
  try { result = await response.json(); }
  catch { throw new SiteApiError("응답을 확인하지 못했습니다. 저장된 내역을 확인해주세요.", { status: response.status, uncertain: mutation && (response.ok || uncertain) }); }
  if (!response.ok) {
    const message = result && typeof result.error === "string" ? result.error : "요청에 실패했습니다.";
    throw new SiteApiError(response.status === 503 ? "일시적인 연결 문제가 발생했습니다. 잠시 후 다시 시도해주세요." : message, { status: response.status, uncertain });
  }
  return result as T;
}

const pollPath = (slug: string) => `/api/polls/${encodeURIComponent(slug)}`;
export const getPoll = (slug: string) => request<PollData>(pollPath(slug));
export const getPollResults = (slug: string) => request<PollOutcome>(`${pollPath(slug)}/results`);
export const getParticipation = (slug: string) => request<PollParticipation>(`${pollPath(slug)}/participation`);
async function submitBallot(slug: string, body: unknown): Promise<VoteStatus> {
  const result = await request<unknown>(`${pollPath(slug)}/votes`, body);
  const statuses: VoteStatus[] = ["success", "vote_changed", "unchanged", "already_voted", "inactive_participant", "poll_not_found", "invalid_option", "invalid_selection", "poll_upcoming", "poll_closed", "legacy_votes_conflict", "invalid_poll_type", "invalid_response", "response_too_long"];
  if (typeof result !== "string" || !statuses.includes(result as VoteStatus)) throw new SiteApiError("등록 여부를 확인하지 못했습니다. 저장된 내역을 확인해주세요.", { status: 200, uncertain: true });
  return result as VoteStatus;
}
export const submitVote = (slug: string, optionIds: DatabaseId[]) => submitBallot(slug, { optionIds });
export const submitTextResponse = (slug: string, textResponse: string) => submitBallot(slug, { textResponse });
export const getComments = (quarter: string, offset = 0) => request<Comment[]>(`/api/comments?quarter=${encodeURIComponent(quarter)}&offset=${offset}`);
export const insertComment = (quarter: string, content: string) => request<Comment>("/api/comments", { quarter, content });
