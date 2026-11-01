"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { getParticipation, submitTextResponse, SiteApiError } from "@/lib/site-api";
import { validateTextResponse } from "@/lib/polls";
import type { PollData, PollParticipation } from "@/lib/supabase/types";
import { useParticipant } from "./ParticipantProvider";

type Feedback = { tone: "success" | "error" | "uncertain"; message: string };
export function TextBallot({ data, onRefresh }: { data: PollData; onRefresh: () => Promise<boolean> }) {
  const { participant, invalidateParticipant } = useParticipant();
  const [participation, setParticipation] = useState<PollParticipation | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const submission = useRef(false), readBusy = useRef(false), readRequest = useRef(0);
  const unconfirmed = useRef<string | null>(null);
  const id = useId(), active = data.status === "ACTIVE";
  const responded = participation?.has_participated === true;
  const length = Array.from(draft).length, maximum = data.poll.text_max_length;

  useEffect(() => {
    if (submission.current || unconfirmed.current !== null) return;
    let current = true;
    const read = ++readRequest.current;
    getParticipation(data.poll.slug).then((value) => {
      if (current && read === readRequest.current) setParticipation(value);
    }).catch(() => {
      if (current && read === readRequest.current) setFeedback({ tone: "error", message: "내 응답을 불러오지 못했습니다. 응답 상태 확인을 눌러주세요." });
    });
    return () => { current = false; };
  }, [participant.id, data.poll.slug, data.server_time]);

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
      if (expected !== null) {
        if (value.has_participated && value.text_response === expected) {
          unconfirmed.current = null; setUncertain(false); setEditing(false);
          await saved("저장된 응답을 확인했습니다. 응답이 반영되었습니다.");
        } else setFeedback({ tone: "uncertain", message: "등록 여부를 아직 확인하지 못했습니다. 추가로 제출하지 말고 잠시 후 응답 상태를 확인해주세요." });
      } else setFeedback(null);
    } catch {
      setFeedback(expected !== null ? { tone: "uncertain", message: "등록 여부를 확인할 수 없습니다. 추가 제출 없이 잠시 후 응답 상태를 확인해주세요." }
        : { tone: "error", message: "내 응답을 불러오지 못했습니다. 잠시 후 응답 상태를 확인해주세요." });
    } finally { readBusy.current = false; setChecking(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submission.current || unconfirmed.current !== null || pending || checking || !participation || !active) return;
    let response: string;
    try { response = validateTextResponse(draft, maximum); }
    catch (error) { setFeedback({ tone: "error", message: (error as Error).message }); return; }
    submission.current = true; readRequest.current++; setPending(true); setFeedback(null);
    try {
      const status = await submitTextResponse(data.poll.slug, response);
      if (status === "inactive_participant") { invalidateParticipant(); return; }
      if (status === "success" || status === "vote_changed" || status === "unchanged") {
        setParticipation({ option_id: null, option_ids: [], text_response: response, vote_count: 1, selection_count: 0, has_participated: true });
        setEditing(false);
        await saved(status === "success" ? "응답이 저장되었습니다." : status === "vote_changed" ? "응답이 수정되었습니다." : "현재 응답이 저장되어 있습니다.");
        return;
      }
      if (status === "already_voted") {
        await checkState(); setFeedback({ tone: "error", message: "이미 응답한 질문입니다. 현재 응답을 확인해주세요." });
      } else {
        const message = status === "poll_closed" ? "종료된 투표에는 응답할 수 없습니다." : status === "poll_upcoming" ? "아직 응답 시작 전입니다."
          : status === "response_too_long" ? `응답은 ${maximum}자 이내로 작성해주세요.` : status === "poll_not_found" ? "응답할 수 없는 투표입니다." : "응답 내용을 확인해주세요. 응답은 저장되지 않았습니다.";
        setFeedback({ tone: "error", message });
      }
      await onRefresh();
    } catch (error) {
      if (error instanceof SiteApiError && !error.uncertain) setFeedback({ tone: "error", message: error.message });
      else {
        unconfirmed.current = response; setUncertain(true);
        setFeedback({ tone: "uncertain", message: "서버 응답을 확인하지 못했습니다. 등록 여부를 확인하고 있습니다." });
        await checkState();
      }
    } finally { submission.current = false; setPending(false); }
  }

  return <div className="text-ballot min-w-0">
    <p className="form-note mb-5">{participant.display_name} 이름으로 응답합니다.</p>
    {!participation && !feedback && <p className="form-note" role="status">내 응답 확인 중...</p>}
    {uncertain ? <p className="form-note">전송한 응답의 등록 여부를 확인할 때까지 추가 제출을 잠시 멈춥니다.</p>
      : responded && (!editing || !active || !data.poll.allow_vote_change) ? <section aria-label="내 응답">
        <h3 className="font-medium text-accent">응답이 제출되었습니다.</h3>
        <p className="mt-5 text-sm text-muted">내 응답</p>
        <p className="mt-3 whitespace-pre-wrap leading-8 wrap-anywhere">{participation?.text_response}</p>
        {active && data.poll.allow_vote_change && <button type="button" className="text-link mt-6" disabled={pending || checking} onClick={() => { setDraft(participation?.text_response ?? ""); setEditing(true); setFeedback(null); }}>응답 수정</button>}
      </section> : active && <form onSubmit={submit} aria-busy={pending}>
        <label htmlFor={id} className="text-sm">{editing ? "응답 수정" : "응답 내용"}</label>
        <textarea id={id} className="response-input mt-3" rows={7} placeholder="의견을 입력해주세요." required maxLength={maximum * 2}
          value={draft} onChange={(event) => setDraft(event.target.value)} disabled={pending || checking || !participation}
          aria-describedby={`${id}-count`} aria-invalid={length > maximum} />
        <p id={`${id}-count`} className={`form-note mt-3 tabular-nums ${length > maximum ? "text-red-700" : ""}`}>{length} / {maximum}</p>
        <div className="mt-6 flex flex-wrap gap-5">
          <button type="submit" className="interaction-button" disabled={pending || checking || !participation || !draft.trim() || length > maximum}>{pending ? "저장 중..." : editing ? "수정 저장" : "응답 제출"}</button>
          {editing && <button type="button" className="text-link" disabled={pending || checking} onClick={() => setEditing(false)}>취소</button>}
        </div>
      </form>}
    <p className={feedback ? "vote-feedback" : "sr-only"} data-tone={feedback?.tone ?? "idle"} role={feedback?.tone === "error" ? "alert" : "status"} aria-live={feedback?.tone === "error" ? "assertive" : "polite"} aria-atomic="true">{feedback?.message ?? ""}</p>
    {(uncertain || (!participation && !!feedback)) && <button type="button" className="text-link mt-4" disabled={pending || checking} onClick={checkState}>{checking ? "응답 상태 확인 중..." : "응답 상태 확인"}</button>}
  </div>;
}
