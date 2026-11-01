"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { getPoll, getParticipation, submitVote, SiteApiError } from "@/lib/site-api";
import type { DatabaseId, PollData, PollParticipation } from "@/lib/supabase/types";
import { formatKoreanDate, formatPollQuarter } from "@/lib/polls";
import { useParticipant } from "./ParticipantProvider";
import { PollResults } from "./PollResults";
import { PollMeta } from "@/components/polls/PollMeta";
import Link from "next/link";
import { TextBallot } from "./TextBallot";
import { TextResponses } from "./TextResponses";

type Feedback = { tone: "success" | "error" | "uncertain"; message: string };
const normalize = (ids: readonly DatabaseId[]) => [...new Set(ids.map(String))].sort();
const sameSelection = (left: readonly DatabaseId[], right: readonly DatabaseId[]) => {
  const a = normalize(left), b = normalize(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
};

export function PollForm({ pollId, initialData, initialError = "" }: { pollId: string; initialData: PollData | null; initialError?: string }) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState(initialError);
  const [pending, setPending] = useState(false);
  const request = useRef(0);
  const { participant } = useParticipant();
  const refresh = useCallback(async () => {
    const current = ++request.current;
    setPending(true);
    try {
      const next = await getPoll(pollId);
      if (current !== request.current) return false;
      setData(next); setError(""); return true;
    } catch { if (current === request.current) setError("투표 정보를 불러오지 못했습니다. 잠시 후 다시 확인해주세요."); return false; }
    finally { if (current === request.current) setPending(false); }
  }, [pollId]);

  useEffect(() => {
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
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
          {data.poll.poll_type === "text" ? <TextBallot key={`${participant.id}-${data.poll.id}`} data={data} onRefresh={refresh} />
            : <Ballot key={`${participant.id}-${data.poll.id}`} data={data} onRefresh={refresh} />}
        </div>
        {data.results ? data.poll.poll_type === "text" ? <TextResponses responses={data.responses ?? []} /> : <PollResults options={data.options} results={data.results} multiple={data.poll.vote_mode === "multiple"} />
          : <p className="interaction-notice">{data.poll.poll_type === "text" ? "전체 응답은 투표 종료 후 공개됩니다." : "결과는 투표 종료 후 공개됩니다."}</p>}
      </div>
    </>}
    {error && <p className="form-error mt-6" role="alert">{error}</p>}
    <button type="button" className="text-link mt-6" onClick={refresh} disabled={pending}>{pending ? "불러오는 중..." : "투표 정보 새로고침"}</button>
  </div>;
}

function Ballot({ data, onRefresh }: { data: PollData; onRefresh: () => Promise<boolean> }) {
  const { participant, invalidateParticipant } = useParticipant();
  const single = data.poll.vote_mode === "single";
  const active = data.status === "ACTIVE";
  const [participation, setParticipation] = useState<PollParticipation | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const submission = useRef(false), readBusy = useRef(false), readRequest = useRef(0);
  const unconfirmed = useRef<string[] | null>(null);
  const id = useId();

  useEffect(() => {
    if (submission.current || unconfirmed.current) return;
    let current = true;
    const read = ++readRequest.current;
    getParticipation(data.poll.slug).then((value) => {
      if (current && read === readRequest.current) setParticipation(value);
    }).catch(() => {
      if (current && read === readRequest.current) setFeedback({ tone: "error", message: "참여 상태를 불러오지 못했습니다. 참여 상태 확인을 눌러주세요." });
    });
    return () => { current = false; };
  }, [participant.id, data.poll.slug, data.server_time]);

  const voted = participation?.has_participated === true;
  const changeAllowed = active && voted && data.poll.allow_vote_change;
  const currentIds = normalize(participation?.option_ids ?? []);
  const currentOptions = data.options.filter(option => currentIds.includes(String(option.id)));

  async function saved(message: string) {
    setFeedback({ tone: "success", message });
    const refreshed = await onRefresh();
    if (!refreshed) setFeedback({ tone: "success", message: `${message} 최신 결과를 불러오지 못했습니다. 투표 정보 새로고침으로 확인해주세요.` });
  }
  async function checkState() {
    if (readBusy.current) return;
    readBusy.current = true; setChecking(true);
    const expected = unconfirmed.current, read = ++readRequest.current;
    try {
      const value = await getParticipation(data.poll.slug);
      if (read !== readRequest.current) return;
      setParticipation(value);
      if (expected) {
        if (value.has_participated && sameSelection(value.option_ids, expected)) {
          unconfirmed.current = null; setUncertain(false); setEditing(false); setSelected([]);
          await saved("저장된 선택을 확인했습니다. 투표가 반영되었습니다.");
        } else setFeedback({ tone: "uncertain", message: "등록 여부를 아직 확인하지 못했습니다. 추가로 제출하지 말고 잠시 후 참여 상태를 확인해주세요." });
      } else setFeedback(null);
    } catch {
      setFeedback(expected ? { tone: "uncertain", message: "등록 여부를 확인할 수 없습니다. 추가 제출 없이 잠시 후 참여 상태를 확인해주세요." }
        : { tone: "error", message: "참여 상태를 불러오지 못했습니다. 잠시 후 참여 상태를 확인해주세요." });
    } finally { readBusy.current = false; setChecking(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submission.current || unconfirmed.current || pending || checking || !active || !participation || !selected.length) return;
    const optionIds = normalize(selected);
    submission.current = true; readRequest.current++; setPending(true); setFeedback(null);
    try {
      const status = await submitVote(data.poll.slug, optionIds);
      if (status === "inactive_participant") { invalidateParticipant(); return; }
      if (status === "success" || status === "vote_changed" || status === "unchanged") {
        setParticipation({ option_id: optionIds[0] ?? null, option_ids: optionIds, text_response: null, vote_count: optionIds.length, selection_count: optionIds.length, has_participated: true });
        setEditing(false); setSelected([]);
        await saved(status === "success" ? single ? "투표가 완료되었습니다." : `투표가 완료되었습니다. 선택한 ${optionIds.length}개 항목에 각각 1표씩 반영되었습니다.`
          : status === "vote_changed" ? "선택이 변경되었습니다." : "현재 선택이 저장되어 있습니다.");
        return;
      }
      if (status === "already_voted") {
        await checkState();
        setFeedback({ tone: "error", message: "이미 참여한 투표입니다. 현재 선택을 확인해주세요." });
      } else {
        const message = status === "poll_closed" ? "종료된 투표에는 참여할 수 없습니다." : status === "poll_upcoming" ? "아직 투표 시작 전입니다."
          : status === "poll_not_found" ? "참여할 수 없는 투표입니다." : status === "legacy_votes_conflict" ? "기존 참여 기록을 확인해야 합니다. 관리자에게 문의해주세요." : "선택지를 확인해주세요. 투표는 저장되지 않았습니다.";
        setFeedback({ tone: "error", message });
        if (status === "invalid_option" || status === "invalid_selection") setSelected([]);
      }
      await onRefresh();
    } catch (error) {
      if (error instanceof SiteApiError && !error.uncertain) setFeedback({ tone: "error", message: error.message });
      else {
        unconfirmed.current = optionIds; setUncertain(true);
        setFeedback({ tone: "uncertain", message: "서버 응답을 확인하지 못했습니다. 등록 여부를 확인하고 있습니다." });
        await checkState();
      }
    } finally { submission.current = false; setPending(false); }
  }

  return <div className="poll-ballot">
    <p className="form-note mb-5">{participant.display_name} 이름으로 참여합니다.</p>
    {!participation && !feedback && <p role="status" className="form-note">참여 상태 확인 중...</p>}
    {uncertain ? <p className="form-note">전송한 선택의 등록 여부를 확인할 때까지 추가 제출을 잠시 멈춥니다.</p>
      : voted && (!editing || !changeAllowed) ? <section aria-label="내 선택" className="py-4">
        <h3 className="font-medium text-accent">✓ 투표에 참여했습니다.</h3><p className="mt-5 text-sm text-muted">현재 선택</p>
        <ul className="mt-2 grid gap-2 text-lg font-medium">{currentOptions.map(option => <li key={option.id}>{option.label}</li>)}</ul>
        {!currentOptions.length && <p className="form-note mt-3">기존 참여 기록을 확인해주세요.</p>}
        {changeAllowed ? <button type="button" className="text-link mt-6" disabled={pending || checking} onClick={() => { setSelected(currentIds); setEditing(true); setFeedback(null); }}>선택 변경하기</button>
          : active && <p className="form-note mt-5">참여 후에는 선택을 변경할 수 없습니다.</p>}
      </section> : active ? <form onSubmit={submit} aria-busy={pending}>
        <fieldset className="poll-options" disabled={pending || checking || !participation}>
          <legend className="sr-only">{single ? "선택지 한 가지" : "선택지 여러 개 선택 가능"}</legend>
          {data.options.map(option => <label key={option.id} className="poll-option">
            <input type={single ? "radio" : "checkbox"} name={id} required={single} value={String(option.id)} checked={selected.includes(String(option.id))}
              onChange={() => { const value = String(option.id); setSelected(current => single ? [value] : current.includes(value) ? current.filter(item => item !== value) : [...current, value]); }} /><span>{option.label}</span>
          </label>)}
        </fieldset>
        {!single && <p className="form-note mt-4">여러 항목을 한 번에 선택할 수 있습니다. 같은 선택지에는 한 사람당 1표만 반영됩니다.</p>}
        <div className="mt-6 flex flex-wrap items-center gap-5"><button type="submit" className="interaction-button" disabled={pending || checking || !participation || selected.length === 0}>{pending ? "저장 중..." : editing ? "변경 저장" : single ? "투표하기" : `${selected.length}개 선택 · 투표하기`}</button>
          {editing && <button type="button" className="text-link" disabled={pending || checking} onClick={() => { setEditing(false); setSelected([]); }}>취소</button>}
        </div>
      </form> : null}
    <p className={feedback ? "vote-feedback" : "sr-only"} data-tone={feedback?.tone ?? "idle"} role={feedback?.tone === "error" ? "alert" : "status"} aria-live={feedback?.tone === "error" ? "assertive" : "polite"} aria-atomic="true">{feedback?.message ?? ""}</p>
    {(uncertain || (!participation && !!feedback)) && <button type="button" className="text-link mt-4" disabled={pending || checking} onClick={checkState}>{checking ? "참여 상태 확인 중..." : "참여 상태 확인"}</button>}
  </div>;
}
