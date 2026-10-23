import type { PollRecord, PollStatus } from "@/lib/supabase/types";
import { formatPollQuarter, POLL_STATUS_LABELS, votingPeriod } from "@/lib/polls";

export function PollMeta({ poll, status }: { poll: PollRecord; status: PollStatus }) {
  return <div className="poll-meta">
    <div className="flex flex-wrap gap-2">
      <span className="quarter-badge">{formatPollQuarter(poll.quarter)}</span>
      <span className="quarter-badge">{POLL_STATUS_LABELS[status]}</span>
      <span className="quarter-badge">{poll.poll_type === "text" ? "주관식 · 1인 1응답" : poll.vote_mode === "single" ? "객관식 · 1인 1표" : "객관식 · 중복 투표 가능"}</span>
      {poll.allow_vote_change && <span className="quarter-badge">{poll.poll_type === "text" ? "응답 수정 가능" : "선택 변경 가능"}</span>}
      <span className="quarter-badge">{poll.results_visibility === "after_close" ? "종료 후 결과 공개" : "결과 실시간 공개"}</span>
      {!poll.voting_starts_at && !poll.voting_ends_at && <span className="quarter-badge">상시 투표</span>}
    </div>
    <p className="mt-4 text-sm text-muted">{votingPeriod(poll)}</p>
  </div>;
}
