"use client";

<<<<<<< HEAD
export function PollResults({ options, results, multiple = false }: { options: PollOption[]; results: PollResultsData; multiple?: boolean }) {
  const { counts, total_votes: total, participant_count: participantCount } = results;
=======
import { useId, useState, useSyncExternalStore } from "react";
import type { PollOption, PollResultsData } from "@/lib/supabase/types";
import { choiceResultRows } from "@/lib/poll-view";
import { ParticipationRate } from "@/components/polls/ParticipationRate";
const subscribe = () => () => {};

export function PollResults({ options, results, multiple = false }: { options: PollOption[]; results: PollResultsData; multiple?: boolean }) {
  const { total_votes: total, participant_count: participantCount } = results;
  const [order, setOrder] = useState<"options" | "votes">("options");
  const id = useId();
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const rows = choiceResultRows(options, results, multiple, order);
>>>>>>> e9843ed (.)

  return (
    <div className="poll-results" aria-label="현재 투표 결과" data-result-mode={multiple ? "multiple" : "single"}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="m-0! text-lg!">현재 결과</h3>
        <span className="text-sm text-muted">참여자 {participantCount}명 · {multiple ? `총 선택 ${total}개` : `총 ${total}표`}</span>
      </div>
      <ParticipationRate results={results} />
      <label htmlFor={id} className="result-sort mt-5 flex flex-wrap items-center gap-3 text-sm text-muted">표시 순서
        <select id={id} value={order} disabled={!ready} onChange={(event) => setOrder(event.target.value === "votes" ? "votes" : "options")}>
          <option value="options">선택지 순</option><option value="votes">득표순</option>
        </select>
      </label>
      <ol className="mt-7 grid gap-6">
<<<<<<< HEAD
        {options.map((option) => {
          const count = counts[option.id] ?? 0;
          const denominator = multiple ? participantCount : total;
          const percentage = denominator ? Math.round(count / denominator * 100) : 0;
=======
        {rows.map(({ option, count, percentage, leader }) => {
>>>>>>> e9843ed (.)
          return (
            <li key={option.id}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span>{option.label}{leader && <span className="ml-2 text-xs text-accent">{leader}</span>}</span>
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
<<<<<<< HEAD
=======
      {!multiple && <p className="form-note mt-6">전체 유효 표를 기준으로 계산한 비율입니다. 반올림으로 합이 100%와 다를 수 있습니다.</p>}
>>>>>>> e9843ed (.)
      {total === 0 && <p className="form-note mt-6">아직 투표가 없습니다. 첫 의견을 남겨주세요.</p>}
    </div>
  );
}
