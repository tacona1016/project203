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
  option_id: DatabaseId;
  participant_id: string;
  created_at: string;
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

export type VoteStatus = "success" | "already_voted" | "inactive_participant" | "poll_not_found" | "invalid_option";

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
      submit_vote: {
        Args: { p_poll_id: DatabaseId; p_option_id: DatabaseId; p_participant_id: string };
        Returns: { status: VoteStatus };
      };
      get_poll_results: { Args: { p_poll_id: DatabaseId }; Returns: PollResultsData };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type PollData = {
  poll: PollRecord;
  options: PollOption[];
  results: PollResultsData | null;
};
