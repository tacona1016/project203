"use client";

import { useId, useState, type FormEvent } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getPoll, getVoteCounts, insertVote } from "@/lib/supabase/queries";
import type { PollData } from "@/lib/supabase/types";
import { useSelectedParticipant } from "@/lib/useSelectedParticipant";
import { NameSelector } from "./NameSelector";
import { PollResults } from "./PollResults";
import { getPollLoadErrorMessage, reportPollLoadError } from "@/lib/supabase/poll-errors";

export function PollForm({ pollId, initialData, initialError = "" }: {
  pollId: string;
  initialData: PollData | null;
  initialError?: string;
}) {
  const [data, setData] = useState(initialData);
  const [optionId, setOptionId] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(initialData ? "" : initialError || "투표를 불러오지 못했습니다. 다시 시도해주세요.");
  const name = useSelectedParticipant();
  const id = useId();

  async function refresh() {
    const client = getSupabaseClient();
    if (!client || pending) return;
    setPending(true);
    setError("");
    try {
      setData(await getPoll(client, pollId));
    } catch (error) {
      reportPollLoadError(pollId, "poll", error);
      setError(getPollLoadErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !data) return;
    if (!name) { setError("먼저 이름을 선택해주세요."); return; }
    if (!optionId) { setError("선택지를 하나 선택해주세요."); return; }
    const client = getSupabaseClient();
    if (!client) { setError("지금은 투표를 등록할 수 없습니다."); return; }

    setPending(true);
    setMessage("");
    setError("");
    try {
      await insertVote(client, data.poll.id, optionId, name);
    } catch {
      setError("등록에 실패했습니다. 다시 시도해주세요.");
      setPending(false);
      return;
    }

    setMessage("투표가 등록되었습니다.");
    setOptionId("");
    try {
      const counts = await getVoteCounts(client, data.poll.id, data.options);
      setData({ ...data, counts });
    } catch {
      setError("투표는 저장되었지만 최신 결과를 불러오지 못했습니다. 결과를 다시 불러와주세요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="poll-interaction">
      {data && <>
        <header className="mb-10 max-w-3xl">
          <h2 id={`${id}-title`} className="section-title">{data.poll.title}</h2>
          {data.poll.description && <p className="mt-4 text-muted">{data.poll.description}</p>}
        </header>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          <form onSubmit={submit} aria-labelledby={`${id}-title`} aria-busy={pending}>
            {!name && <div className="identity-prompt"><p>투표에 표시할 이름을 선택해주세요.</p><NameSelector /></div>}
            {name && <p className="form-note mb-4">{name} 이름으로 참여합니다.</p>}
            <fieldset disabled={pending} className="poll-options">
              <legend className="sr-only">가장 중요한 요소 한 가지</legend>
              {data.options.map((option) => (
                <label key={option.id} className="poll-option">
                  <input type="radio" name={`${id}-option`} value={String(option.id)} checked={optionId === String(option.id)}
                    onChange={() => setOptionId(String(option.id))} required />
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>
            <button className="interaction-button mt-6" type="submit" disabled={pending || !name || !optionId}>
              {pending ? "등록 중..." : "투표하기"}
            </button>
            <p className="form-note mt-3">중복 참여가 가능합니다. 결과는 전체 투표 수 기준입니다.</p>
          </form>
          {data.counts !== null ? <PollResults options={data.options} counts={data.counts} /> : (
            <div className="poll-results">
              <p className="form-error" role="alert">투표 결과를 불러오지 못했습니다. 다시 시도해주세요.</p>
              <button type="button" className="text-link" onClick={refresh} disabled={pending}>
                {pending ? "불러오는 중..." : "결과 다시 불러오기"}
              </button>
            </div>
          )}
        </div>
      </>}
      <p role="status" className="form-feedback">{message}</p>
      {error && <div role="alert" className="form-error">
        <p>{error}</p>
        <button type="button" className="text-link" onClick={refresh} disabled={pending}>
          {pending ? "불러오는 중..." : data ? "결과 다시 불러오기" : "다시 불러오기"}
        </button>
      </div>}
    </div>
  );
}
