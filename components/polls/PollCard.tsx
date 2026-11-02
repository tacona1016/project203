import Link from "next/link";
import type { PollSummary } from "@/lib/supabase/types";
import { PollMeta } from "./PollMeta";
import { ParticipationRate } from "./ParticipationRate";

export function PollCard({ summary, showCounts = true }: { summary: PollSummary; showCounts?: boolean }) {
  const { poll, status, results, ownParticipation } = summary;
  const participated = ownParticipation?.hasParticipated;
  const ownLabel = participated === undefined ? "참여 상태 확인 불가" : participated ? "참여 완료" : "미참여";
  return <article className="poll-card">
    <h2 className="text-xl font-medium tracking-tight sm:text-2xl"><Link href={`/polls/${poll.slug}`} className="hover:text-accent">{poll.title}</Link></h2>
    {poll.description && <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">{poll.description}</p>}
    <div className="mt-6"><PollMeta poll={poll} status={status} serverTime={summary.server_time} /></div>
    <p className="poll-personal-state mt-4 text-sm" data-participation={participated === undefined ? "unknown" : participated ? "complete" : "pending"}>
      <span className="text-muted">내 참여 · </span><span>{ownLabel}</span>
      {participated && status === "ACTIVE" && poll.allow_vote_change && <span className="text-muted"> · {poll.poll_type === "text" ? "응답 수정 가능" : "선택 변경 가능"}</span>}
    </p>
    {showCounts && results && <ParticipationRate results={results} />}
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
      {showCounts && <p className="text-sm text-muted">{results ? `참여자 ${results.participant_count}명 · ${poll.poll_type === "choice" && poll.vote_mode === "multiple" ? `총 선택 ${results.total_votes}개` : `총 ${results.total_votes}${poll.poll_type === "text" ? "응답" : "표"}`}` : "결과는 투표 종료 후 공개됩니다."}</p>}
      <Link className="text-link" href={`/polls/${poll.slug}`}>{status === "CLOSED" ? "결과 보기" : status === "UPCOMING" ? "투표 살펴보기" : participated ? poll.poll_type === "text" ? "내 응답 보기" : "내 선택 보기" : poll.poll_type === "text" ? "응답하기" : "투표하기"} →</Link>
    </div>
  </article>;
}
