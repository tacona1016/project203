import { BOARD_LIMITS, boardTextLength } from "./validation.ts";
import type { BoardInput } from "./types";

export const BOARD_DRAFT_TTL = 7 * 86400000;
export type BoardDraft = BoardInput & { version: 1; owner: string; scope: string; savedAt: number; expiresAt: number };

export function boardDraftKey(owner: string, scope: string) {
  return `project203_board_draft:v1:${owner}:${scope}`;
}
export function createBoardDraft(owner: string, scope: string, input: BoardInput, now = Date.now()): BoardDraft {
  if (!owner || !scope || boardTextLength(input.title) > BOARD_LIMITS.title || boardTextLength(input.content) > BOARD_LIMITS.content) throw new Error("제한을 초과한 내용은 임시저장할 수 없습니다.");
  return { ...input, version: 1, owner, scope, savedAt: now, expiresAt: now + BOARD_DRAFT_TTL };
}
export function readBoardDraft(raw: string | null, owner: string, scope: string, now = Date.now()): BoardDraft | null {
  try {
    const value = raw ? JSON.parse(raw) as BoardDraft : null;
    if (!value || value.version !== 1 || value.owner !== owner || value.scope !== scope || !Number.isFinite(value.savedAt) || !Number.isFinite(value.expiresAt)
      || value.savedAt > now || value.expiresAt <= now || value.expiresAt - value.savedAt !== BOARD_DRAFT_TTL
      || typeof value.title !== "string" || typeof value.content !== "string" || typeof value.is_pinned !== "boolean"
      || !["general", "notice"].includes(value.post_type) || value.is_pinned && value.post_type !== "notice"
      || boardTextLength(value.title) > BOARD_LIMITS.title || boardTextLength(value.content) > BOARD_LIMITS.content) return null;
    return value;
  } catch { return null; }
}
