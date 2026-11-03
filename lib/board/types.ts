import type { DatabaseId } from "@/lib/supabase/types";

export type BoardPostType = "general" | "notice";
export type LikeState = { count: number; liked: boolean };
export type BoardImage = { id: string; post_id: DatabaseId; content_type: "image/webp"; byte_size: number; width: number; height: number; sort_order: number; created_at: string };
export type BoardImageRecord = BoardImage & { uploaded_by: string; storage_path: string; sha256: string; state: "pending" | "ready" | "deleting"; upload_token: string; updated_at: string };
export type BoardEngagement = { post: LikeState; comments: Record<string, LikeState>; images: BoardImage[] };
export type BoardPost = {
  id: DatabaseId; author_id: string; author_name: string;
  title: string; content: string; post_type: BoardPostType; is_pinned: boolean;
  created_at: string; updated_at: string; deleted_at: string | null; comment_count: number;
  likes?: LikeState | null; images?: BoardImage[] | null;
};
export type BoardListItem = Omit<BoardPost, "content" | "deleted_at">;
export type BoardPage = { pinned: BoardListItem[]; posts: BoardListItem[]; total: number; page: number; page_size: number };
export type BoardComment = {
  id: DatabaseId; post_id: DatabaseId; author_id: string; author_name: string;
  content: string; created_at: string; updated_at: string; deleted_at: string | null;
  likes?: LikeState | null;
};
export type BoardInput = { title: string; content: string; post_type: BoardPostType; is_pinned: boolean };
export type BoardViewer = { participantId: string | null; isAdmin: boolean; verified: boolean };
