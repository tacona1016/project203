import "server-only";
import { protectedClient } from "@/lib/site-data";
import type { DatabaseId } from "@/lib/supabase/types";
import { contentLinks, validContentLinks } from "@/data/content-links";
import { quarters } from "@/data/quarters";
import { homeDecisionIds, selectHomeDecisions } from "@/lib/home-decisions";

export type LatestNotice = { id: DatabaseId; title: string; is_pinned: boolean; created_at: string };

export async function getLatestBoardNotices(): Promise<LatestNotice[]> {
  const { data, error } = await (await protectedClient()).from("board_posts")
    .select("id,title,is_pinned,created_at").eq("post_type", "notice").is("deleted_at", null)
    .order("is_pinned", { ascending: false }).order("created_at", { ascending: false })
    .order("id", { ascending: false }).limit(3).retry(false);
  if (error) throw error;
  return data ?? [];
}

export async function getHomeDecisionNotices() {
  const groups = validContentLinks(contentLinks, quarters);
  const ids = homeDecisionIds(groups);
  if (!ids.length) return [];
  const client = await protectedClient();
  const { data, error } = await client.from("board_posts")
    .select("id,title,is_pinned,created_at").in("id", ids)
    .eq("post_type", "notice").is("deleted_at", null)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(3).retry(false);
  if (error) throw error;
  const notices = selectHomeDecisions(data ?? [], groups);
  const slugs = [...new Set(groups.filter(group => group.decisionPostIds.some(id => notices.some(notice => String(notice.id) === id)))
    .flatMap(group => group.pollSlugs))];
  // One batched lookup; only existing, visible Poll titles/URLs, never results.
  const polls = slugs.length ? await client.from("polls").select("slug,title").in("slug", slugs).eq("is_hidden", false).retry(false) : { data: [], error: null };
  return notices.map(notice => ({ ...notice, pollsUnavailable: !!polls.error,
    polls: (polls.data ?? []).filter(poll => groups.some(group => group.decisionPostIds.includes(String(notice.id)) && group.pollSlugs.includes(poll.slug))),
  }));
}
