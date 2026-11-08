import Link from "next/link";
import type { PollSummary } from "@/lib/supabase/types";
import { PollMeta } from "./PollMeta";
import { ParticipationRate } from "./ParticipationRate";
import { formatKoreanDate, POLL_STATUS_LABELS } from "@/lib/polls";
import { PollDeadline } from "./PollDeadline";

export function PollCard({ summary, showCounts = true, compact = false }: { summary: PollSummary; showCounts?: boolean; compact?: boolean }) {
  const { poll, status, results, ownParticipation } = summary;
  const participated = ownParticipation?.hasParticipated;
  const ownLabel = participated === undefined ? "참여 상태 확인 불가" : participated ? "참여 완료" : "미참여";
  const date = status === "UPCOMING" ? poll.voting_starts_at : poll.voting_ends_at;
  return <article className="poll-card poll-list-card" data-poll-status={status}>
    <div className="poll-card-heading">
      <h2><Link href={`/polls/${poll.slug}`} className="hover:text-accent">{poll.title}</Link></h2>
      <span className="quarter-badge">{POLL_STATUS_LABELS[status]}</span>
    </div>
    <div className="poll-list-meta">
      <span>{poll.poll_type === "text" ? "주관식 · 1인 1응답" : poll.vote_mode === "multiple" ? "객관식 · 복수선택" : "객관식 · 1인 1표"}</span>
      {date ? <time dateTime={date}>{formatKoreanDate(date)} {status === "UPCOMING" ? "시작" : "마감"}</time> : <span>상시 투표</span>}
      <PollDeadline poll={poll} status={status} serverTime={summary.server_time} compact />
    </div>
    <div className="poll-card-footer">
      <p className="poll-personal-state text-sm" data-participation={participated === undefined ? "unknown" : participated ? "complete" : "pending"}>
      <span className="text-muted">내 참여 · </span><span>{ownLabel}</span>
      {participated && status === "ACTIVE" && poll.allow_vote_change && <span className="text-muted"> · {poll.poll_type === "text" ? "응답 수정 가능" : "선택 변경 가능"}</span>}
      </p>
      {showCounts && results && <ParticipationRate results={results} compact />}
      <Link className={status === "ACTIVE" && participated === false ? "interaction-button poll-card-action" : "text-link poll-card-action"} href={`/polls/${poll.slug}`}>{status === "CLOSED" ? "결과 보기" : status === "UPCOMING" ? "투표 살펴보기" : participated ? poll.poll_type === "text" ? "내 응답 보기" : "내 선택 보기" : poll.poll_type === "text" ? "응답하기" : "투표하기"} →</Link>
    </div>
    {!compact && <details className="poll-card-details"><summary>투표 정보</summary>
      {poll.description && <p className="mb-3 text-sm leading-7 text-muted">{poll.description}</p>}
      <PollMeta poll={poll} status={status} />
      {showCounts && <p className="form-note mt-3">{results ? `참여자 ${results.participant_count}명 · ${poll.poll_type === "choice" && poll.vote_mode === "multiple" ? `총 선택 ${results.total_votes}개` : `총 ${results.total_votes}${poll.poll_type === "text" ? "응답" : "표"}`}` : "결과는 투표 종료 후 공개됩니다."}</p>}
    </details>}
  </article>;
}
