"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { Participant } from "@/lib/supabase/types";

type ParticipantDialogProps = {
  open: boolean;
  canDismiss: boolean;
  participants: Participant[];
  currentId: string;
  isLoading: boolean;
  error: string;
  storageWarning: boolean;
  onSelect: (id: string) => Promise<void>;
  onRetry: () => Promise<void>;
  onClose: () => void;
};

export function ParticipantDialog({ open, canDismiss, participants, currentId, isLoading, error, storageWarning, onSelect, onRetry, onClose }: ParticipantDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const select = useRef<HTMLSelectElement>(null);
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [retrying, setRetrying] = useState(false);
  const id = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open) {
      if (!element.open) element.showModal();
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = previous; };
    }
    if (element.open) element.close();
  }, [open]);

  useEffect(() => {
    if (open && !isLoading && !error) select.current?.focus();
  }, [open, isLoading, error, currentId, participants.length]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const value = select.current?.value;
    if (!value) { setSubmitError("이름을 선택해주세요."); return; }
    setPending(true);
    setSubmitError("");
    try {
      await onSelect(value);
    } catch {
      setSubmitError("이름을 확인하지 못했습니다. 목록을 다시 불러온 뒤 선택해주세요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <dialog ref={dialog} className="participant-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
      closedby={canDismiss && !pending ? "closerequest" : "none"}
      onCancel={(event) => { event.preventDefault(); if (canDismiss && !pending) onClose(); }}
      onKeyDown={(event) => { if (event.key === "Escape" && (!canDismiss || pending)) event.preventDefault(); }}
      onClose={() => {
        if (!open) return;
        if (!canDismiss || pending) dialog.current?.showModal();
        else onClose();
      }}>
      <div className="flex items-center justify-between gap-4">
        <p className="eyebrow text-accent">203 PROJECT</p>
        {canDismiss && <button type="button" className="text-link" disabled={pending} onClick={onClose} aria-label="이름 선택 닫기">닫기</button>}
      </div>
      <h2 id={`${id}-title`} className="section-title mt-10">{currentId ? "이름 변경" : "누구신가요?"}</h2>
      <p id={`${id}-description`} className="mt-4 text-sm leading-7 text-muted">함께 남기는 기록에 표시할 이름을 선택해주세요.</p>
      <form onSubmit={submit} className="mt-8" aria-busy={pending || isLoading || retrying}>
        <label htmlFor={`${id}-select`} className="sr-only">이름 선택</label>
        <select key={`${open}-${currentId}-${participants.map((item) => item.id).join(",")}`} ref={select} id={`${id}-select`} defaultValue={currentId}
          disabled={isLoading || pending || retrying || !participants.length} required className="participant-select">
          <option value="" disabled>{isLoading ? "이름을 불러오는 중..." : "이름을 선택해주세요"}</option>
          {participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.display_name}</option>)}
        </select>
        <button type="submit" className="interaction-button mt-5 w-full" disabled={pending || isLoading || retrying || !participants.length}>
          {pending ? "확인 중..." : currentId ? "변경하기" : "시작하기"}
        </button>
      </form>
      {(error || submitError) && <div role="alert" className="form-error mt-4">
        <p>{submitError || error}</p>
        <button type="button" className="text-link" disabled={pending || retrying} onClick={async () => {
          setRetrying(true); setSubmitError("");
          try { await onRetry(); } finally { setRetrying(false); }
        }}>{retrying ? "불러오는 중..." : "목록 다시 불러오기"}</button>
      </div>}
      {storageWarning && <p className="form-note mt-4">이 브라우저에서는 이름이 다음 방문까지 저장되지 않습니다.</p>}
    </dialog>
  );
}
