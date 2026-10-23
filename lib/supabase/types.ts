import type { BoardPage, BoardPost, BoardComment } from "@/lib/board/types";

// 기존 숫자 ID를 유지하고 SDK·폼에서 사용하는 문자열/숫자 표현을 처리합니다.
export type DatabaseId = string | number;

export type Participant = {
  id: string;
  display_name: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
};

export type PollRecord = {
  id: DatabaseId;
  slug: string;
  quarter: string;
  title: string;
  description: string;
  allow_repeat_vote: boolean;
  poll_type: "choice" | "text";
  results_visibility: "live" | "after_close";
  text_max_length: number;
  vote_mode: "single" | "multiple";
  allow_vote_change: boolean;
  voting_starts_at: string | null;
  voting_ends_at: string | null;
  is_closed: boolean;
  is_hidden: boolean;
  updated_at: string;
  created_at: string;
};

export type PollOption = {
  id: DatabaseId;
  poll_id: DatabaseId;
  label: string;
  display_order: number;
};

export type Vote = {
  id: DatabaseId;
  poll_id: DatabaseId;
  option_id: DatabaseId | null;
  text_response: string | null;
  participant_id: string;
  created_at: string;
  updated_at: string;
};

export type CommentRecord = {
  id: DatabaseId;
  quarter: string;
  participant_id: string;
  content: string;
  created_at: string;
};

export type Comment = CommentRecord & { participant: Pick<Participant, "id" | "display_name"> };

export type PollResultsData = {
  counts: Record<string, number>;
  total_votes: number;
  participant_count: number;
};

export type VoteStatus = "success" | "vote_changed" | "unchanged" | "already_voted" | "inactive_participant" | "poll_not_found" | "invalid_option" | "poll_upcoming" | "poll_closed" | "legacy_votes_conflict" | "invalid_poll_type" | "invalid_response" | "response_too_long";
export type PollStatus = "UPCOMING" | "ACTIVE" | "CLOSED" | "HIDDEN";
export type PollSummary = { poll: PollRecord; status: PollStatus; results: PollResultsData | null; server_time: string };
export type PollParticipation = { option_id: DatabaseId | null; text_response: string | null; vote_count: number };
export type TextResponse = Pick<Vote, "id" | "participant_id" | "text_response" | "created_at" | "updated_at"> & { participant_name: string };
export type PollOutcome = { results: PollResultsData | null; responses: TextResponse[] | null };
export type PollInput = {
  quarter: string;
  poll_type: "choice" | "text"; results_visibility: "live" | "after_close"; text_max_length: number;
  title: string; description: string; vote_mode: "single" | "multiple";
  allow_vote_change: boolean; voting_starts_at: string | null; voting_ends_at: string | null;
  is_hidden: boolean; options: string[];
};

// migration과 함께 관리합니다. 표는 RPC로, 댓글은 participant_id로 등록합니다.
type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<Row, Insert, Relations extends Relationship[] = []> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
  Relationships: Relations;
};

export type Database = {
  public: {
    Tables: {
      participants: Table<Participant, Omit<Participant, "id" | "created_at">>;
      polls: Table<PollRecord, Omit<PollRecord, "created_at">>;
      poll_options: Table<PollOption, Omit<PollOption, "id">>;
      votes: Table<Vote, never>;
      comments: Table<CommentRecord, Pick<CommentRecord, "quarter" | "participant_id" | "content">, [{
        foreignKeyName: "comments_participant_id_fkey";
        columns: ["participant_id"];
        isOneToOne: false;
        referencedRelation: "participants";
        referencedColumns: ["id"];
      }]>;
    };
    Views: Record<string, never>;
    Functions: {
      get_board_page: { Args: { p_search: string; p_page: number }; Returns: BoardPage };
      get_board_post: { Args: { p_id: DatabaseId }; Returns: BoardPost | null };
      get_board_comments: { Args: { p_post_id: DatabaseId; p_page: number }; Returns: BoardComment[] };
      write_board_post: { Args: { p_id: DatabaseId | null; p_actor_id: string; p_is_admin: boolean; p_title: string; p_content: string; p_post_type: string; p_is_pinned: boolean }; Returns: { id: DatabaseId } };
      delete_board_post: { Args: { p_id: DatabaseId; p_actor_id: string; p_is_admin: boolean }; Returns: { success: boolean } };
      create_board_comment: { Args: { p_post_id: DatabaseId; p_actor_id: string; p_content: string }; Returns: { id: DatabaseId } };
      delete_board_comment: { Args: { p_post_id: DatabaseId; p_id: DatabaseId; p_actor_id: string; p_is_admin: boolean }; Returns: { success: boolean } };
      submit_vote: {
        Args: { p_poll_id: DatabaseId; p_option_id: DatabaseId; p_participant_id: string };
        Returns: { status: VoteStatus };
      };
      get_poll_results: { Args: { p_poll_id: DatabaseId }; Returns: PollResultsData };
      get_poll_catalog: { Args: { p_slug?: string | null; p_include_hidden?: boolean }; Returns: PollSummary[] };
      get_poll_detail: { Args: { p_slug: string; p_admin?: boolean }; Returns: PollData | null };
      submit_text_response: { Args: { p_poll_id: DatabaseId; p_participant_id: string; p_text_response: string }; Returns: { status: VoteStatus } };
      admin_create_poll: { Args: { p_data: PollInput }; Returns: { slug: string } };
      admin_update_poll: { Args: { p_poll_id: DatabaseId; p_data: PollInput }; Returns: { slug: string } };
      admin_set_poll_state: { Args: { p_poll_id: DatabaseId; p_action: string }; Returns: { slug: string } };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type PollData = {
  poll: PollRecord;
  options: PollOption[];
  results: PollResultsData | null;
  responses: TextResponse[] | null;
  status: PollStatus;
  server_time: string;
};
