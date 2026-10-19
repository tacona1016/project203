// 기존 UUID/text ID와 Supabase에서 생성한 bigint ID를 모두 읽을 수 있습니다.
export type DatabaseId = string | number;

export type PollRecord = {
  id: DatabaseId;
  slug: string;
  quarter: string;
  title: string;
  description: string;
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
  participant_name: string;
  created_at: string;
};

export type Comment = {
  id: DatabaseId;
  quarter: string;
  participant_name: string;
  content: string;
  created_at: string;
};

// schema.sql과 함께 관리합니다. 브라우저에서는 votes/comments의 INSERT만 사용합니다.
type Table<Row, Insert> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      polls: Table<PollRecord, Omit<PollRecord, "created_at">>;
      poll_options: Table<PollOption, Omit<PollOption, "id">>;
      votes: Table<Vote, Pick<Vote, "poll_id" | "option_id" | "participant_name">>;
      comments: Table<Comment, Pick<Comment, "quarter" | "participant_name" | "content">>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type PollData = {
  poll: PollRecord;
  options: PollOption[];
  counts: Record<string, number> | null;
};
