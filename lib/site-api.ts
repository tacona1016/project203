"use client";

import type { Comment, Participant, PollData, PollResultsData, VoteStatus, DatabaseId } from "@/lib/supabase/types";

export const COMMENTS_PAGE_SIZE = 20;

async function request<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store",
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  if (response.status === 401) {
    const returnTo = window.location.pathname + window.location.search;
    window.location.replace(`/access?next=${encodeURIComponent(returnTo)}`);
    throw new Error("사이트 비밀번호 인증이 필요합니다.");
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "요청에 실패했습니다.");
  return result as T;
}

const pollPath = (slug: string) => `/api/polls/${encodeURIComponent(slug)}`;
export const getParticipants = () => request<Participant[]>("/api/participants");
export const getActiveParticipant = (id: string) => request<Participant | null>(`/api/participants?id=${encodeURIComponent(id)}`);
export const getPoll = (slug: string) => request<PollData>(pollPath(slug));
export const getPollResults = (slug: string) => request<PollResultsData>(`${pollPath(slug)}/results`);
export const hasVoted = (slug: string, participantId: string) => request<boolean>(`${pollPath(slug)}/participation?participantId=${encodeURIComponent(participantId)}`);
export const submitVote = (slug: string, optionId: DatabaseId, participantId: string) => request<VoteStatus>(`${pollPath(slug)}/votes`, { optionId, participantId });
export const getComments = (quarter: string, offset = 0) => request<Comment[]>(`/api/comments?quarter=${encodeURIComponent(quarter)}&offset=${offset}`);
export const insertComment = (quarter: string, participantId: string, content: string) => request<Comment>("/api/comments", { quarter, participantId, content });
