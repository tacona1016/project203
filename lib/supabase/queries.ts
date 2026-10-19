import type { SupabaseClient } from "@supabase/supabase-js";
import { isParticipant } from "@/data/participants";
import type { Database, DatabaseId, PollData, PollOption } from "./types";
import { reportPollLoadError } from "./poll-errors";

type Client = SupabaseClient<Database>;
export const COMMENTS_PAGE_SIZE = 20;

export async function getVoteCounts(client: Client, pollId: DatabaseId, options: PollOption[]) {
  // COUNT로 집계해 Supabase의 기본 SELECT 행 제한에도 결과가 잘리지 않습니다.
  const entries = await Promise.all(options.map(async (option) => {
    const { count, error } = await client.from("votes")
      .select("id", { count: "exact", head: true })
      .eq("poll_id", pollId).eq("option_id", option.id);
    if (error) throw error;
    return [option.id, count ?? 0] as const;
  }));
  return Object.fromEntries(entries);
}

export async function getPoll(client: Client, pollSlug: string): Promise<PollData> {
  // MDX에서는 읽기 쉬운 slug를 쓰고, FK 조회·등록에는 실제 DB ID를 사용합니다.
  const pollResult = await client.from("polls").select("*").eq("slug", pollSlug).single();
  if (pollResult.error) throw pollResult.error;
  const pollId = pollResult.data.id;
  const optionsResult = await client.from("poll_options").select("*")
    .eq("poll_id", pollId).order("display_order");
  if (optionsResult.error) throw optionsResult.error;
  if (!optionsResult.data.length) throw new Error("POLL_OPTIONS_MISSING");
  // 결과 조회에 실패해도 질문과 선택지는 표시합니다. 실패를 0표로 표현하지 않습니다.
  const counts = await getVoteCounts(client, pollId, optionsResult.data).catch((error) => {
    reportPollLoadError(pollSlug, "results", error);
    return null;
  });
  return { poll: pollResult.data, options: optionsResult.data, counts };
}

export async function insertVote(client: Client, pollId: DatabaseId, optionId: DatabaseId, name: string) {
  if (!isParticipant(name)) throw new Error("Select a participant first.");
  const { error } = await client.from("votes").insert({
    poll_id: pollId, option_id: optionId, participant_name: name,
  });
  if (error) throw error;
}

export async function getComments(client: Client, quarter: string, offset = 0) {
  const { data, error } = await client.from("comments").select("*")
    .eq("quarter", quarter)
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .range(offset, offset + COMMENTS_PAGE_SIZE - 1);
  if (error) throw error;
  return data;
}

export async function insertComment(client: Client, quarter: string, name: string, value: string) {
  const content = value.trim();
  if (!isParticipant(name) || !content || Array.from(content).length > 1000) {
    throw new Error("Invalid comment.");
  }
  const { data, error } = await client.from("comments")
    .insert({ quarter, participant_name: name, content }).select("*").single();
  if (error) throw error;
  return data;
}
