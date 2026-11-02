import "server-only";
import { protectedClient } from "@/lib/site-data";
import type { DatabaseId } from "@/lib/supabase/types";

export type LatestNotice = { id: DatabaseId; title: string; is_pinned: boolean; created_at: string };

export async function getLatestBoardNotices(): Promise<LatestNotice[]> {
  const { data, error } = await (await protectedClient()).from("board_posts")
    .select("id,title,is_pinned,created_at").eq("post_type", "notice").is("deleted_at", null)
    .order("is_pinned", { ascending: false }).order("created_at", { ascending: false })
    .order("id", { ascending: false }).limit(3).retry(false);
  if (error) throw error;
  return data ?? [];
}
