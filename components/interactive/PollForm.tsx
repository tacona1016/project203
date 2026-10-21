"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getPoll, getPollResults, hasVoted, submitVote } from "@/lib/supabase/queries";
import type { PollData } from "@/lib/supabase/types";
import { getPollLoadErrorMessage, reportPollLoadError } from "@/lib/supabase/poll-errors";
import { useParticipant } from "./ParticipantProvider";
import { NameSelector } from "./NameSelector";
import { PollResults } from "./PollResults";

type CheckStatus = "checking" | "ready" | "voted" | "error";

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
  const [checks, setChecks] = useState<Record<string, CheckStatus>>({});
  const [checkVersion, setCheckVersion] = useState(0);
  const { participant, isLoading, invalidateParticipant } = useParticipant();
  const participantId = participant?.id;
  const databaseId = data?.poll.id;
  const repeatAllowed = data?.poll.allow_repeat_vote ?? false;
  const checkStatus = participantId ? checks[participantId] ?? "checking" : "checking";
  const alreadyVoted = !repeatAllowed && checkStatus === "voted";
  const id = useId();

  useEffect(() => {
    if (repeatAllowed || !participantId || databaseId === undefined) return;
    let current = true;
    const client = getSupabaseClient();
    const request = client ? hasVoted(client, databaseId, participantId) : Promise.reject(new Error("Not configured"));
    request.then((voted) => {
      if (current) setChecks((previous) => ({ ...previous, [participantId]: voted ? "voted" : "ready" }));
    }).catch(() => {
      if (current) setChecks((previous) => ({ ...previous, [participantId]: "error" }));
    });
    return () => { current = false; };
  }, [repeatAllowed, participantId, databaseId, checkVersion]);

  async function refresh() {
    const client = getSupabaseClient();
    if (!client || pending) return;
    setPending(true);
    setError("");
    try {
      setData(await getPoll(client, pollId));
      setCheckVersion((value) => value + 1);
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
    if (!participant) { setError("먼저 이름을 선택해주세요."); return; }
    if (!optionId) { setError("선택지를 하나 선택해주세요."); return; }
    const client = getSupabaseClient();
    if (!client) { setError("지금은 투표를 등록할 수 없습니다."); return; }

    setPending(true);
    setMessage("");
    setError("");
    try {
      const status = await submitVote(client, data.poll.id, optionId, participant.id);
      if (status === "inactive_participant") {
        setError("현재 선택할 수 없는 이름입니다. 이름을 다시 선택해주세요.");
        invalidateParticipant();
        return;
      }
      if (status === "invalid_option") { setError("선택지를 확인하지 못했습니다. 투표를 다시 불러와주세요."); return; }
      if (status === "poll_not_found") { setError("진행 중인 투표를 찾지 못했습니다."); return; }
      if (status !== "success" && status !== "already_voted") throw new Error("Unexpected vote response");
      if (!repeatAllowed || status === "already_voted") {
        setChecks((previous) => ({ ...previous, [participant.id]: "voted" }));
      }
      if (status === "already_voted") {
        setData((previous) => previous ? { ...previous, poll: { ...previous.poll, allow_repeat_vote: false } } : previous);
      }
      setMessage(status === "success" ? "투표가 등록되었습니다." : "이미 참여한 투표입니다.");
      setOptionId("");
      try {
        const results = await getPollResults(client, data.poll.id);
        setData((previous) => previous ? { ...previous, results } : previous);
      } catch {
        setError(status === "success"
          ? "투표는 저장되었지만 최신 결과를 불러오지 못했습니다. 결과를 다시 불러와주세요."
          : "최신 결과를 불러오지 못했습니다. 다시 시도해주세요.");
      }
    } catch {
      setError("등록에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="poll-interaction">
      {data && <>
        <header className="mb-10 max-w-3xl">
          <h2 id={id + "-title"} className="section-title">{data.poll.title}</h2>
          {data.poll.description && <p className="mt-4 text-muted">{data.poll.description}</p>}
          <span className="quarter-badge mt-5">{repeatAllowed ? "중복 투표 가능" : "1인 1표"}</span>
        </header>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          {alreadyVoted ? (
            <div className="py-5" role="status">
              <p className="text-lg font-medium text-accent">✓ 투표에 참여했습니다.</p>
              <p className="form-note mt-3">이미 참여한 투표입니다. 현재 결과를 확인해주세요.</p>
            </div>
          ) : (
            <form onSubmit={submit} aria-labelledby={id + "-title"} aria-busy={pending}>
              {!participant && <div className="identity-prompt"><p>투표에 표시할 이름을 선택해주세요.</p><NameSelector /></div>}
              {participant && <p className="form-note mb-4">{participant.display_name} 이름으로 참여합니다.</p>}
              {!repeatAllowed && participant && checkStatus === "checking" && <p className="form-note mb-4" role="status">참여 여부 확인 중...</p>}
              {!repeatAllowed && participant && checkStatus === "error" && <div className="form-error mb-4" role="alert">
                <p>참여 여부를 확인하지 못했습니다.</p>
                <button type="button" className="text-link" onClick={() => {
                  setChecks((previous) => ({ ...previous, [participant.id]: "checking" }));
                  setCheckVersion((value) => value + 1);
                }}>참여 여부 다시 확인</button>
              </div>}
              <fieldset disabled={pending || isLoading || (!repeatAllowed && !!participant && checkStatus !== "ready")} className="poll-options">
                <legend className="sr-only">가장 중요한 요소 한 가지</legend>
                {data.options.map((option) => (
                  <label key={option.id} className="poll-option">
                    <input type="radio" name={id + "-option"} value={String(option.id)} checked={optionId === String(option.id)}
                      onChange={() => setOptionId(String(option.id))} required />
                    <span>{option.label}</span>
                  </label>
                ))}
              </fieldset>
              <button className="interaction-button mt-6" type="submit"
                disabled={pending || isLoading || !participant || !optionId || (!repeatAllowed && checkStatus !== "ready")}>
                {pending ? "등록 중..." : "투표하기"}
              </button>
              <p className="form-note mt-3">{repeatAllowed ? "여러 번 참여할 수 있습니다. 각 투표가 별도로 집계됩니다." : "한 이름당 한 번 참여할 수 있습니다. 참여 후에는 변경할 수 없습니다."}</p>
            </form>
          )}
          {data.results !== null ? <PollResults options={data.options} results={data.results} /> : (
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
