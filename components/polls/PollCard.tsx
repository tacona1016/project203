import Link from "next/link";
import type { PollSummary } from "@/lib/supabase/types";
import { PollMeta } from "./PollMeta";

export function PollCard({ summary, showCounts = true }: { summary: PollSummary; showCounts?: boolean }) {
  const { poll, status, results } = summary;
  return <article className="poll-card">
    <h2 className="text-xl font-medium tracking-tight sm:text-2xl"><Link href={`/polls/${poll.slug}`} className="hover:text-accent">{poll.title}</Link></h2>
    {poll.description && <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">{poll.description}</p>}
    <div className="mt-6"><PollMeta poll={poll} status={status} /></div>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
      {showCounts && <p className="text-sm text-muted">{results ? `참여자 ${results.participant_count}명 · 총 ${results.total_votes}${poll.poll_type === "text" ? "응답" : "표"}` : "결과는 투표 종료 후 공개됩니다."}</p>}
      <Link className="text-link" href={`/polls/${poll.slug}`}>{status === "CLOSED" ? "결과 보기" : status === "UPCOMING" ? "투표 살펴보기" : poll.poll_type === "text" ? "Respond" : "Vote"} →</Link>
    </div>
  </article>;
}
