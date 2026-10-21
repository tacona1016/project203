"use client";

import { useId, useState, type FormEvent } from "react";
import { useParticipant } from "./ParticipantProvider";
import { NameSelector } from "./NameSelector";

type CommentFormProps = {
  pending: boolean;
  onSubmit: (participantId: string, content: string) => Promise<boolean>;
};

export function CommentForm({ pending, onSubmit }: CommentFormProps) {
  const { participant, isLoading } = useParticipant();
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const id = useId();
  const length = Array.from(content).length;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const trimmed = content.trim();
    if (!participant) { setError("먼저 이름을 선택해주세요."); return; }
    if (!trimmed) { setError("의견을 입력해주세요."); return; }
    if (Array.from(trimmed).length > 1000) { setError("댓글은 1000자 이내로 작성해주세요."); return; }
    setError("");
    if (await onSubmit(participant.id, trimmed)) setContent("");
  }

  return (
    <form onSubmit={submit} aria-busy={pending} className="comment-form">
      {!participant && <div className="identity-prompt"><p>댓글에 표시할 이름을 선택해주세요.</p><NameSelector /></div>}
      {participant && <p className="form-note mb-4">{participant.display_name} 이름으로 남깁니다.</p>}
      <label htmlFor={id} className="sr-only">프로젝트에 대한 의견</label>
      <textarea id={id} rows={5} value={content} disabled={pending} required
        placeholder="의견을 입력하세요..." aria-describedby={`${id}-limit${error ? ` ${id}-error` : ""}`}
        aria-invalid={length > 1000 || !!error}
        onChange={(event) => { setContent(event.target.value); setError(""); }} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <span id={`${id}-limit`} className={length > 1000 ? "form-error" : "form-note"}>{length} / 1000자</span>
        <button type="submit" className="interaction-button" disabled={pending || isLoading || !participant || !content.trim() || Array.from(content.trim()).length > 1000}>
          {pending ? "등록 중..." : "댓글 등록"}
        </button>
      </div>
      {error && <p id={`${id}-error`} role="alert" className="form-error mt-3">{error}</p>}
    </form>
  );
}
