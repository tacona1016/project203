import type { PollResultsData } from "@/lib/supabase/types";
import { participationRate } from "@/lib/poll-view";

export function ParticipationRate({ results, compact = false }: { results: PollResultsData; compact?: boolean }) {
  const denominator = results.eligible_participant_count;
  const rate = participationRate(results.participant_count, denominator);
  if (denominator === undefined) return null;
  return <div className={`participation-rate ${compact ? "participation-rate-compact" : "mt-4"}`}>
    <p className={compact ? "text-muted" : "text-sm text-muted"}>{results.participant_count} / {denominator}명 참여{rate !== null && <span className="ml-2 font-medium text-accent">{rate}%</span>}</p>
    {!compact && rate !== null && <div className="mt-2 h-1 overflow-hidden bg-line" aria-hidden="true"><div className="h-full bg-accent" style={{ width: `${rate}%` }} /></div>}
    <p className={compact ? "sr-only" : "form-note mt-2"}>현재 등록회원 기준 · 비활성 회원 포함{rate === null ? ". 회원 수와 과거 참여 범위가 달라 참여율은 표시하지 않습니다." : ""}</p>
  </div>;
}
