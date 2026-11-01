import type { PollOption, PollResultsData } from "@/lib/supabase/types";

export function PollResults({ options, results, multiple = false }: { options: PollOption[]; results: PollResultsData; multiple?: boolean }) {
  const { counts, total_votes: total, participant_count: participantCount } = results;

  return (
    <div className="poll-results" aria-label="현재 투표 결과" data-result-mode={multiple ? "multiple" : "single"}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="m-0! text-lg!">현재 결과</h3>
        <span className="text-sm text-muted">참여자 {participantCount}명 · {multiple ? `총 선택 ${total}개` : `총 ${total}표`}</span>
      </div>
      <ol className="mt-7 grid gap-6">
        {options.map((option) => {
          const count = counts[option.id] ?? 0;
          const denominator = multiple ? participantCount : total;
          const percentage = denominator ? Math.round(count / denominator * 100) : 0;
          return (
            <li key={option.id}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span>{option.label}</span>
                <span className="text-muted tabular-nums">{count}표 · {percentage}%</span>
              </div>
              <div className="h-1.5 overflow-hidden bg-line" aria-hidden="true">
                <div className="h-full bg-accent" style={{ width: `${Math.min(percentage, 100)}%` }} />
              </div>
            </li>
          );
        })}
      </ol>
      {multiple && <p className="form-note mt-6">참여자 기준 선택률입니다. 복수 선택이므로 비율의 합은 100%를 넘을 수 있습니다.</p>}
      {total === 0 && <p className="form-note mt-6">아직 투표가 없습니다. 첫 의견을 남겨주세요.</p>}
    </div>
  );
}
