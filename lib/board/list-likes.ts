import type { BoardPage } from "./types.ts";
import type { DatabaseId } from "../supabase/types.ts";

export function boardPagePostIds(page: BoardPage): DatabaseId[] {
  return [...new Map([...page.pinned, ...page.posts].map(post => [String(post.id), post.id])).values()];
}

// An exact count also detects the Data API's row ceiling: never silently
// report truncated results as complete counts. Only post IDs enter this mapper.
export function withBoardLikeCounts(page: BoardPage, rows: { post_id: DatabaseId }[] | null, exactCount: number | null): BoardPage {
  const counts = new Map(boardPagePostIds(page).map(id => [String(id), 0]));
  const complete = rows !== null && Number.isSafeInteger(exactCount) && exactCount === rows.length
    && rows.every(row => counts.has(String(row.post_id)));
  if (complete) for (const row of rows) counts.set(String(row.post_id), counts.get(String(row.post_id))! + 1);
  const add = (post: BoardPage["posts"][number]) => ({ ...post, like_count: complete ? counts.get(String(post.id))! : null });
  return { ...page, pinned: page.pinned.map(add), posts: page.posts.map(add) };
}
