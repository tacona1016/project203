"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { getParticipation, submitTextResponse } from "@/lib/site-api";
import { validateTextResponse } from "@/lib/polls";
import type { PollData, PollParticipation } from "@/lib/supabase/types";
import { useParticipant } from "./ParticipantProvider";
import { NameSelector } from "./NameSelector";

export function TextBallot({ data, onRefresh, onFeedback }: { data: PollData; onRefresh: () => Promise<void>; onFeedback: (value: string) => void }) {
  const { participant, isLoading, invalidateParticipant } = useParticipant();
  const [participation, setParticipation] = useState<PollParticipation | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const id = useId();
  const active = data.status === "ACTIVE";
  const responded = (participation?.vote_count ?? 0) > 0;
  const length = Array.from(draft).length;
  const maximum = data.poll.text_max_length;

  useEffect(() => {
    if (!participant) return;
    let current = true;
    getParticipation(data.poll.slug, participant.id)
      .then((value) => { if (current) { setParticipation(value); setError(""); } })
      .catch(() => { if (current) setError("내 응답을 확인하지 못했습니다. 다시 시도해주세요."); });
    return () => { current = false; };
  }, [participant, data.poll.slug, data.server_time, retry]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !participant || !participation || !active) return;
    let response: string;
    try { response = validateTextResponse(draft, maximum); }
    catch (error) { setError((error as Error).message); return; }
    setPending(true); setError(""); onFeedback("");
    try {
      const status = await submitTextResponse(data.poll.slug, participant.id, response);
      if (status === "inactive_participant") { invalidateParticipant(); setError("이름을 다시 선택해주세요."); return; }
      if (status === "success" || status === "vote_changed" || status === "unchanged") {
        setParticipation({ option_id: null, text_response: response, vote_count: 1 }); setEditing(false);
        onFeedback(status === "success" ? "응답이 제출되었습니다." : status === "vote_changed" ? "응답이 수정되었습니다." : "기존 응답을 유지했습니다.");
        await onRefresh(); return;
      }
      if (status === "already_voted") { setError("이미 응답한 질문입니다. 추가로 제출할 수 없습니다."); await onRefresh(); return; }
      if (status === "poll_closed" || status === "poll_upcoming" || status === "poll_not_found" || status === "invalid_poll_type") { await onRefresh(); return; }
      setError(status === "response_too_long" ? `응답은 ${maximum}자 이내로 작성해주세요.` : "응답 내용을 확인해주세요.");
    } catch { setError("응답 제출에 실패했습니다. 다시 시도해주세요."); }
    finally { setPending(false); }
  }

  return <div className="min-w-0">
    {!participant && <div className="identity-prompt"><p>응답에 표시할 이름을 선택해주세요.</p><NameSelector /></div>}
    {participant && <p className="form-note mb-5">{participant.display_name} 이름으로 응답합니다.</p>}
    {participant && !participation && !error && <p className="form-note" role="status">내 응답 확인 중...</p>}
    {responded && (!editing || !active || !data.poll.allow_vote_change) ? <section aria-label="내 응답">
      <h3 className="font-medium text-accent">응답이 제출되었습니다.</h3>
      <p className="mt-5 text-sm text-muted">내 응답</p>
      <p className="mt-3 whitespace-pre-wrap leading-8 wrap-anywhere">{participation?.text_response}</p>
      {active && data.poll.allow_vote_change && <button type="button" className="text-link mt-6" disabled={pending} onClick={() => { setDraft(participation?.text_response ?? ""); setEditing(true); }}>응답 수정</button>}
    </section> : active && <form onSubmit={submit} aria-busy={pending}>
      <label htmlFor={id} className="text-sm">{editing ? "응답 수정" : "응답 내용"}</label>
      <textarea id={id} className="response-input mt-3" rows={7} placeholder="의견을 입력해주세요." required maxLength={maximum * 2}
        value={draft} onChange={(event) => setDraft(event.target.value)} disabled={pending || isLoading || !participant || !participation}
        aria-describedby={`${id}-count`} aria-invalid={length > maximum} />
      <p id={`${id}-count`} className={`form-note mt-3 tabular-nums ${length > maximum ? "text-red-700" : ""}`}>{length} / {maximum}</p>
      <div className="mt-6 flex flex-wrap gap-5">
        <button type="submit" className="interaction-button" disabled={pending || isLoading || !participant || !participation || !draft.trim() || length > maximum}>{pending ? "제출 중..." : editing ? "수정 저장" : "응답 제출"}</button>
        {editing && <button type="button" className="text-link" disabled={pending} onClick={() => setEditing(false)}>취소</button>}
      </div>
    </form>}
    {error && <div className="form-error mt-5" role="alert"><p>{error}</p>{!participation && <button type="button" className="text-link mt-3" onClick={() => { setError(""); setRetry((value) => value + 1); }}>내 응답 다시 확인</button>}</div>}
  </div>;
}
