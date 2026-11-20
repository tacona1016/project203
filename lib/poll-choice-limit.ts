export type ChoiceLimit = 2 | 3 | 4 | 5 | null;
export function parseChoiceLimit(value: unknown): ChoiceLimit {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 2 || value > 5) throw new Error("최대 선택 개수는 제한 없음 또는 2~5개의 정수로 설정해주세요.");
  return value as ChoiceLimit;
}
export function effectiveChoiceLimit(poll: { poll_type: string; vote_mode: string; max_choices_per_participant?: ChoiceLimit }) {
  return poll.poll_type === "choice" && poll.vote_mode === "multiple" ? poll.max_choices_per_participant ?? null : null;
}
export function choiceLimitMessage(limit: number) { return `최대 ${limit}개까지 선택할 수 있습니다. 다른 선택지를 선택하려면 기존 선택을 해제해주세요.`; }
