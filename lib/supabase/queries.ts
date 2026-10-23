import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "@/lib/auth/http";
import type { Database, DatabaseId, PollData } from "./types";
import { canShowPollResults } from "@/lib/polls";

type Client = SupabaseClient<Database>;
export const COMMENTS_PAGE_SIZE = 20;

export async function getParticipants(client: Client) {
  const { data, error } = await client.from("participants").select("*")
    .eq("is_active", true).order("display_order").order("display_name");
  if (error) throw error;
  return data;
}

export async function getActiveParticipant(client: Client, id: string) {
  const { data, error } = await client.from("participants").select("*")
    .eq("id", id).eq("is_active", true).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getParticipation(client: Client, pollId: DatabaseId, participantId: string) {
  if (!await getActiveParticipant(client, participantId)) throw new HttpError(400, "현재 선택할 수 없는 이름입니다.");
  const { data, count, error } = await client.from("votes").select("option_id,text_response", { count: "exact" })
    .eq("poll_id", pollId).eq("participant_id", participantId).order("id").limit(1);
  if (error) throw error;
  return { option_id: data[0]?.option_id ?? null, text_response: data[0]?.text_response ?? null, vote_count: count ?? 0 };
}

export async function getPollCatalog(client: Client, includeHidden = false) {
  const { data, error } = await client.rpc("get_poll_catalog", { p_include_hidden: includeHidden });
  if (error) throw error;
  // Defense in depth: do not serialize unpublished aggregates, including in RSC props.
  return data.map((summary) => includeHidden || canShowPollResults(summary.poll, summary.status) ? summary : { ...summary, results: null });
}

export async function getPoll(client: Client, slug: string, includeHidden = false): Promise<PollData> {
  // One DB statement supplies metadata, status and only the outcomes allowed by policy.
  const { data, error } = await client.rpc("get_poll_detail", { p_slug: slug, p_admin: includeHidden });
  if (error) throw error;
  if (!data) throw new HttpError(404, "투표를 찾지 못했습니다.");
  if (data.poll.poll_type === "choice" && !data.options.length) throw new Error("POLL_OPTIONS_MISSING");
  return includeHidden || canShowPollResults(data.poll, data.status) ? data : { ...data, results: null, responses: null };
}

export async function submitTextResponse(client: Client, pollId: DatabaseId, participantId: string, text: string) {
  const { data, error } = await client.rpc("submit_text_response", { p_poll_id: pollId, p_participant_id: participantId, p_text_response: text });
  if (error) throw error;
  return data.status;
}

export async function submitVote(client: Client, pollId: DatabaseId, optionId: DatabaseId, participantId: string) {
  const { data, error } = await client.rpc("submit_vote", {
    p_poll_id: pollId, p_option_id: optionId, p_participant_id: participantId,
  });
  if (error) throw error;
  return data.status;
}

const commentFields = "id,quarter,participant_id,content,created_at,participant:participants!comments_participant_id_fkey(id,display_name)" as const;

export async function getComments(client: Client, quarter: string, offset = 0) {
  const { data, error } = await client.from("comments").select(commentFields)
    .eq("quarter", quarter)
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .range(offset, offset + COMMENTS_PAGE_SIZE - 1);
  if (error) throw error;
  return data;
}

export async function insertComment(client: Client, quarter: string, participantId: string, value: string) {
  const content = value.trim();
  if (!participantId || !content || Array.from(content).length > 1000) {
    throw new HttpError(400, "댓글은 1~1000자로 작성해주세요.");
  }
  // The server key bypasses RLS, so validate the selected identity explicitly.
  if (!await getActiveParticipant(client, participantId)) throw new HttpError(400, "현재 선택할 수 없는 이름입니다. 다시 선택해주세요.");
  const { data, error } = await client.from("comments")
    .insert({ quarter, participant_id: participantId, content }).select(commentFields).single();
  if (error) throw error;
  return data;
}
