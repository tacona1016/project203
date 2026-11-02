import type { BoardInput, BoardPostType } from "./types";

export const BOARD_PAGE_SIZE = 10;
export const BOARD_COMMENT_PAGE_SIZE = 30;
export const BOARD_LIMITS = { title: 160, content: 10000, comment: 2000 } as const;

// Match PostgreSQL char_length and the existing stored-text validation. HTML
// maxLength counts UTF-16 units and would count a basic emoji twice.
export function boardTextLength(value: string): number {
  return Array.from(value.trim()).length;
}
export function boardPage(value: unknown): number {
  if (value === undefined || value === null || value === "") return 1;
  if (typeof value !== "string" || !/^[1-9]\d{0,5}$/.test(value)) throw new Error("페이지 정보를 확인해주세요.");
  return Number(value);
}
export function boardSearch(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || boardTextLength(value) > 100) throw new Error("검색어는 100자 이내로 입력해주세요.");
  return value.trim();
}
export function boardInput(value: Record<string, unknown>): BoardInput {
  // Identity and privileges are derived exclusively from server sessions.
  if (Object.keys(value).some((key) => !["title", "content", "post_type", "is_pinned"].includes(key))) throw new Error("허용되지 않은 입력입니다.");
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const content = typeof value.content === "string" ? value.content.trim() : "";
  if (!title || boardTextLength(title) > BOARD_LIMITS.title) throw new Error(`제목은 1~${BOARD_LIMITS.title}자로 작성해주세요.`);
  if (!content || boardTextLength(content) > BOARD_LIMITS.content) throw new Error(`본문은 1~${BOARD_LIMITS.content}자로 작성해주세요.`);
  if (value.post_type !== "general" && value.post_type !== "notice") throw new Error("게시글 유형을 확인해주세요.");
  if (typeof value.is_pinned !== "boolean" || (value.is_pinned && value.post_type !== "notice")) throw new Error("공지사항만 상단에 고정할 수 있습니다.");
  return { title, content, post_type: value.post_type as BoardPostType, is_pinned: value.is_pinned };
}
export function boardCommentInput(value: Record<string, unknown>): string {
  if (Object.keys(value).some((key) => key !== "content")) throw new Error("허용되지 않은 입력입니다.");
  const content = typeof value.content === "string" ? value.content.trim() : "";
  if (!content || boardTextLength(content) > BOARD_LIMITS.comment) throw new Error(`댓글은 1~${BOARD_LIMITS.comment}자로 작성해주세요.`);
  return content;
}
export function canManageBoardPost(post: { author_id: string; post_type: BoardPostType }, viewer: { participantId: string | null; isAdmin: boolean; verified: boolean }) {
  return viewer.isAdmin || (viewer.verified && post.post_type === "general" && post.author_id === viewer.participantId);
}
