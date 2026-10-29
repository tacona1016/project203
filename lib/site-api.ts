"use client";

import type { Comment, PollData, PollOutcome, VoteStatus, DatabaseId, PollParticipation } from "@/lib/supabase/types";

export const COMMENTS_PAGE_SIZE = 20;

async function request<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store",
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  if (response.status === 401) {
    const returnTo = window.location.pathname + window.location.search;
    window.location.replace(`/access?next=${encodeURIComponent(returnTo)}`);
    throw new Error("회원 로그인이 필요합니다.");
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "요청에 실패했습니다.");
  return result as T;
}

const pollPath = (slug: string) => `/api/polls/${encodeURIComponent(slug)}`;
export const getPoll = (slug: string) => request<PollData>(pollPath(slug));
export const getPollResults = (slug: string) => request<PollOutcome>(`${pollPath(slug)}/results`);
export const getParticipation = (slug: string) => request<PollParticipation>(`${pollPath(slug)}/participation`);
export const submitVote = (slug: string, optionId: DatabaseId) => request<VoteStatus>(`${pollPath(slug)}/votes`, { optionId });
export const submitTextResponse = (slug: string, textResponse: string) => request<VoteStatus>(`${pollPath(slug)}/votes`, { textResponse });
export const getComments = (quarter: string, offset = 0) => request<Comment[]>(`/api/comments?quarter=${encodeURIComponent(quarter)}&offset=${offset}`);
export const insertComment = (quarter: string, content: string) => request<Comment>("/api/comments", { quarter, content });
