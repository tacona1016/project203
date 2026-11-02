"use client";

import { useEffect, useState } from "react";
import { boardDraftKey, createBoardDraft, readBoardDraft, type BoardDraft } from "@/lib/board/draft";
import type { BoardInput } from "@/lib/board/types";
import { formatKoreanDate } from "@/lib/polls";

export function BoardDraftTools({ owner, scope, value, onRestore, committed }: { owner: string; scope: string; value: BoardInput; onRestore: (draft: BoardInput) => void; committed: { readonly current: boolean } }) {
  const key = boardDraftKey(owner, scope);
  const [enabled, setEnabled] = useState(false), [available, setAvailable] = useState<BoardDraft | null>(null);
  const [ready, setReady] = useState(false), [note, setNote] = useState("");
  const { title, content, post_type: type, is_pinned: pinned } = value;
  useEffect(() => {
    let current = true;
    Promise.resolve().then(() => {
      try {
        const raw = localStorage.getItem(key), draft = readBoardDraft(raw, owner, scope);
        if (raw && !draft) localStorage.removeItem(key);
        if (current) setAvailable(draft);
      } catch { if (current) setNote("이 브라우저에서는 임시저장을 사용할 수 없습니다."); }
      if (current) setReady(true);
    });
    return () => { current = false; };
  }, [key, owner, scope]);
  useEffect(() => {
    if (!enabled || !ready) return;
    function save(showNote = true) {
      // A pagehide after a confirmed save must not recreate the deleted draft.
      if (committed.current) return;
      try {
        if (!title && !content) { localStorage.removeItem(key); return; }
        const draft = createBoardDraft(owner, scope, { title, content, post_type: type, is_pinned: pinned });
        localStorage.setItem(key, JSON.stringify(draft));
        if (showNote) setNote(`이 기기에 임시저장됨 · ${formatKoreanDate(new Date(draft.savedAt).toISOString())}`);
      } catch { if (showNote) setNote("임시저장하지 못했습니다. 글자 수나 브라우저 저장 공간을 확인해주세요."); }
    }
    const timer = window.setTimeout(() => save(), 0);
    const onLeave = () => save(false);
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("beforeunload", onLeave);
    return () => { clearTimeout(timer); window.removeEventListener("pagehide", onLeave); window.removeEventListener("beforeunload", onLeave); };
  }, [enabled, ready, key, owner, scope, title, content, type, pinned, committed]);
  function remove() {
    try { localStorage.removeItem(key); setAvailable(null); setEnabled(false); setNote("이 기기의 임시저장을 삭제했습니다."); }
    catch { setNote("임시저장을 삭제하지 못했습니다. 브라우저 저장 설정을 확인해주세요."); }
  }
  return <aside className="board-draft-tools interaction-notice mb-7" aria-label="이 기기 임시저장">
    <label className="board-check"><input type="checkbox" checked={enabled} disabled={!ready} onChange={event => {
      if (!event.target.checked) { remove(); return; }
      if (available && !window.confirm("기존 임시저장을 현재 작성 내용으로 바꿀까요? 복원하려면 먼저 불러오기를 선택하세요.")) return;
      setAvailable(null); setEnabled(true); setNote("");
    }} />이 기기에 7일간 자동 임시저장</label>
    <p className="form-note mt-3">선택한 경우에만 이 브라우저에 본문을 저장합니다. 공용 기기에서는 사용하지 마세요. 다른 기기로 동기화되지 않으며 같은 기기를 쓰는 사람이 저장소를 볼 수 있습니다.</p>
    {available && <div className="mt-4 flex flex-wrap items-center gap-5"><p className="text-sm">{formatKoreanDate(new Date(available.savedAt).toISOString())} 임시작성 내용이 있습니다.</p>
      <button type="button" className="text-link" onClick={() => {
        if ((title.trim() || content.trim()) && !window.confirm("현재 입력을 이 기기의 임시작성 내용으로 바꿀까요?")) return;
        onRestore(available); setAvailable(null); setEnabled(true); setNote("임시작성 내용을 불러왔습니다. 등록 전 내용을 확인해주세요.");
      }}>임시작성 불러오기</button><button type="button" className="text-link" onClick={remove}>임시저장 삭제</button></div>}
    {enabled && <button type="button" className="text-link mt-4" onClick={remove}>임시저장 삭제</button>}
    {note && <p className="form-note mt-3" role="status">{note}</p>}
  </aside>;
}
