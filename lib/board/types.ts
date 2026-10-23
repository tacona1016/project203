import type { DatabaseId } from "@/lib/supabase/types";

export type BoardPostType = "general" | "notice";
export type BoardPost = {
  id: DatabaseId; author_id: string; author_name: string;
  title: string; content: string; post_type: BoardPostType; is_pinned: boolean;
  created_at: string; updated_at: string; deleted_at: string | null; comment_count: number;
};
export type BoardListItem = Omit<BoardPost, "content" | "deleted_at">;
export type BoardPage = { pinned: BoardListItem[]; posts: BoardListItem[]; total: number; page: number; page_size: number };
export type BoardComment = {
  id: DatabaseId; post_id: DatabaseId; author_id: string; author_name: string;
  content: string; created_at: string; updated_at: string; deleted_at: string | null;
};
export type BoardInput = { title: string; content: string; post_type: BoardPostType; is_pinned: boolean };
export type BoardPasswordIssue = "not_configured" | "invalid_json" | "missing_participant" | "invalid_length" | "whitespace";
export type BoardViewer = { participantId: string | null; isAdmin: boolean; verified: boolean; configured: boolean; configurationIssue?: BoardPasswordIssue | null };
