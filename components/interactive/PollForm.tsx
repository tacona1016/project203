"use client";

import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { getPoll, getParticipation, submitVote } from "@/lib/site-api";
import type { PollData, PollParticipation } from "@/lib/supabase/types";
import { formatKoreanDate, formatPollQuarter } from "@/lib/polls";
import { useParticipant } from "./ParticipantProvider";
import { NameSelector } from "./NameSelector";
import { PollResults } from "./PollResults";
import { PollMeta } from "@/components/polls/PollMeta";
import Link from "next/link";
import { TextBallot } from "./TextBallot";
import { TextResponses } from "./TextResponses";

export function PollForm({ pollId, initialData, initialError = "" }: { pollId: string; initialData: PollData | null; initialError?: string }) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState(initialError);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const { participant } = useParticipant();
  const refresh = useCallback(async () => {
    setPending(true);
    try { setData(await getPoll(pollId)); setError(""); }
    catch { setError("투표 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요."); }
    finally { setPending(false); }
  }, [pollId]);

  useEffect(() => {
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    // Schedule a server recheck from its own timestamp; the browser does not decide status.
    const boundary = data?.status === "UPCOMING" ? data.poll.voting_starts_at : data?.status === "ACTIVE" ? data.poll.voting_ends_at : null;
    const delay = boundary && data ? new Date(boundary).getTime() - new Date(data.server_time).getTime() : null;
    const timer = delay === null ? undefined : window.setTimeout(onFocus, Math.min(Math.max(delay + 150, 150), 2_147_483_647));
    return () => { window.removeEventListener("focus", onFocus); if (timer !== undefined) window.clearTimeout(timer); };
  }, [data, refresh]);

  return <div className="poll-interaction">
    {data && <>
      <header className="mb-10 max-w-3xl">
        <Link href={`/polls/${data.poll.quarter}`} className="text-link mb-6">Polls / {formatPollQuarter(data.poll.quarter)}</Link>
        <h2 className="section-title">{data.poll.title}</h2>
        {data.poll.description && <p className="mt-4 text-muted">{data.poll.description}</p>}
        <div className="mt-6"><PollMeta poll={data.poll} status={data.status} /></div>
      </header>
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
        <div className="min-w-0">
        {data.status !== "ACTIVE" && <div className="interaction-notice mb-8" role="status"><p className="text-lg font-medium text-ink">{data.status === "UPCOMING" ? "투표 예정" : "투표 종료"}</p>
            {data.status === "UPCOMING" && data.poll.voting_starts_at && <p className="mt-3">{formatKoreanDate(data.poll.voting_starts_at)}부터 참여할 수 있습니다.</p>}
            {data.status === "CLOSED" && <p className="mt-3">{data.poll.is_closed ? "관리자가 투표를 종료했습니다." : "투표 기간이 종료되었습니다."} 현재 결과를 확인해주세요.</p>}
          </div>}
        {data.poll.poll_type === "text" ? <TextBallot key={`${participant?.id ?? "none"}-${data.poll.id}`} data={data} onRefresh={refresh} onFeedback={setMessage} />
          : data.status === "ACTIVE" && <Ballot key={`${participant?.id ?? "none"}-${data.poll.id}`} data={data} onRefresh={refresh} onFeedback={setMessage} />}
        </div>
        {data.results ? data.poll.poll_type === "text" ? <TextResponses responses={data.responses ?? []} /> : <PollResults options={data.options} results={data.results} />
          : <p className="interaction-notice">{data.poll.poll_type === "text" ? "전체 응답은 투표 종료 후 공개됩니다." : "결과는 투표 종료 후 공개됩니다."}</p>}
      </div>
    </>}
    <p className="form-feedback" role="status">{message}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button type="button" className="text-link mt-6" onClick={refresh} disabled={pending}>{pending ? "불러오는 중..." : "투표 정보 새로고침"}</button>
  </div>;
}

function Ballot({ data, onRefresh, onFeedback }: { data: PollData; onRefresh: () => Promise<void>; onFeedback: (value: string) => void }) {
  const { participant, isLoading, invalidateParticipant } = useParticipant();
  const single = data.poll.vote_mode === "single";
  const [participation, setParticipation] = useState<PollParticipation | null>(single ? null : { option_id: null, text_response: null, vote_count: 0 });
  const [optionId, setOptionId] = useState("");
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const id = useId();
  useEffect(() => {
    if (!single || !participant) return;
    let current = true;
    getParticipation(data.poll.slug).then((value) => { if (current) setParticipation(value); })
      .catch(() => { if (current) setError("참여 여부를 확인하지 못했습니다. 다시 시도해주세요."); });
    return () => { current = false; };
  }, [single, participant, data.poll.slug, data.server_time, retry]);
  const voted = single && (participation?.vote_count ?? 0) > 0;
  const changeAllowed = voted && data.poll.allow_vote_change && participation?.vote_count === 1;
  const currentLabel = data.options.find((option) => String(option.id) === String(participation?.option_id))?.label;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !participant || !optionId || !participation) return;
    setPending(true); setError(""); onFeedback("");
    try {
      const status = await submitVote(data.poll.slug, optionId);
      if (status === "inactive_participant") { invalidateParticipant(); setError("다시 로그인해주세요."); return; }
      const messages = { success: "투표가 등록되었습니다.", vote_changed: "선택이 변경되었습니다.", unchanged: "현재 선택을 유지했습니다.", already_voted: "이미 참여한 투표입니다." };
      if (status in messages) {
        if (single && status !== "already_voted") { setParticipation({ option_id: optionId, text_response: null, vote_count: 1 }); setEditing(false); }
        onFeedback(messages[status as keyof typeof messages]); await onRefresh(); return;
      }
      if (status === "poll_closed" || status === "poll_upcoming" || status === "poll_not_found") { await onRefresh(); return; }
      setError(status === "legacy_votes_conflict" ? "기존 참여 기록이 여러 개여서 선택을 변경할 수 없습니다." : "선택지를 확인하지 못했습니다. 다시 시도해주세요.");
    } catch { setError("등록에 실패했습니다. 다시 시도해주세요."); }
    finally { setPending(false); }
  }
  return <div>
    {!participant && <div className="identity-prompt"><p>회원 로그인이 필요합니다.</p><NameSelector /></div>}
    {participant && <p className="form-note mb-5">{participant.display_name} 이름으로 참여합니다.</p>}
    {single && participant && !participation && !error && <p role="status" className="form-note">참여 여부 확인 중...</p>}
    {voted && (!editing || !changeAllowed) ? <div className="py-4" role="status">
      <p className="font-medium text-accent">✓ 투표에 참여했습니다.</p><p className="mt-5 text-sm text-muted">현재 선택</p><p className="mt-2 text-xl font-medium">{currentLabel ?? "기존 참여 기록"}</p>
      {changeAllowed ? <button type="button" className="text-link mt-6" disabled={pending} onClick={() => { setOptionId(String(participation?.option_id)); setEditing(true); }}>선택 변경하기</button>
        : <p className="form-note mt-5">{data.poll.allow_vote_change ? "기존 참여 기록이 여러 개여서 변경할 수 없습니다." : "한 이름당 한 번 참여할 수 있습니다. 참여 후에는 변경할 수 없습니다."}</p>}
    </div> : <form onSubmit={submit} aria-busy={pending}>
      <fieldset className="poll-options" disabled={pending || isLoading || !participant || !participation}>
        <legend className="sr-only">선택지 한 가지</legend>
        {data.options.map((option) => <label key={option.id} className="poll-option">
          <input type="radio" name={id} required value={String(option.id)} checked={optionId === String(option.id)} onChange={() => setOptionId(String(option.id))} /><span>{option.label}</span>
        </label>)}
      </fieldset>
      <div className="mt-6 flex flex-wrap items-center gap-5"><button type="submit" className="interaction-button" disabled={pending || isLoading || !participant || !participation || !optionId}>{pending ? "투표 중..." : editing ? "변경 저장" : "투표하기"}</button>
        {editing && <button type="button" className="text-link" disabled={pending} onClick={() => setEditing(false)}>취소</button>}
      </div>
      {!single && <p className="form-note mt-4">여러 번 참여할 수 있습니다. 각 투표가 별도로 집계됩니다.</p>}
    </form>}
    {error && <div className="form-error mt-4" role="alert"><p>{error}</p>{!participation && <button className="text-link" type="button" onClick={() => { setError(""); setRetry((value) => value + 1); }}>참여 여부 다시 확인</button>}</div>}
  </div>;
}
