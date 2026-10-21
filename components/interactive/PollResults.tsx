import type { PollOption, PollResultsData } from "@/lib/supabase/types";

export function PollResults({ options, results }: { options: PollOption[]; results: PollResultsData }) {
  const { counts, total_votes: total, participant_count: participantCount } = results;

  return (
    <div className="poll-results" aria-label="현재 투표 결과">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="m-0! text-lg!">현재 결과</h3>
        <span className="text-sm text-muted">참여자 {participantCount}명 · 총 {total}표</span>
      </div>
      <ol className="mt-7 grid gap-6">
        {options.map((option) => {
          const count = counts[option.id] ?? 0;
          const percentage = total ? Math.round(count / total * 100) : 0;
          return (
            <li key={option.id}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span>{option.label}</span>
                <span className="text-muted tabular-nums">{count}표 · {percentage}%</span>
              </div>
              <div className="h-1.5 overflow-hidden bg-line" aria-hidden="true">
                <div className="h-full bg-accent" style={{ width: `${percentage}%` }} />
              </div>
            </li>
          );
        })}
      </ol>
      {total === 0 && <p className="form-note mt-6">아직 투표가 없습니다. 첫 의견을 남겨주세요.</p>}
    </div>
  );
}
