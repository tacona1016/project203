"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useParticipant } from "@/components/interactive/ParticipantProvider";
import { boardRequest } from "@/lib/board/client";
import { useBoard } from "./BoardProvider";
import type { BoardPasswordIssue } from "@/lib/board/types";

const configurationMessages: Record<BoardPasswordIssue, string> = {
  not_configured: "게시판 개인 비밀번호가 아직 설정되지 않았습니다. 관리자에게 설정을 요청해주세요.",
  invalid_json: "개인 비밀번호 설정을 읽을 수 없습니다. 관리자에게 설정 형식을 확인해달라고 요청해주세요.",
  missing_participant: "선택한 이름의 개인 비밀번호가 설정되어 있지 않습니다. 관리자에게 문의해주세요.",
  invalid_length: "설정된 개인 비밀번호는 10~1024자여야 합니다. 관리자에게 확인해주세요.",
  whitespace: "설정된 개인 비밀번호의 앞뒤 공백을 제거해야 합니다. 관리자에게 확인해주세요.",
};

export function BoardIdentity() {
  const { participant, changeParticipant } = useParticipant();
  const { viewer, loading, error, refresh } = useBoard();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState("");
  const id = useId(), router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return;
    // Read the actual input, including autofill that did not fire onChange.
    const submittedPassword = new FormData(event.currentTarget).get("password");
    if (typeof submittedPassword !== "string" || !submittedPassword) return;
    setPending(true); setFailure("");
    try { await boardRequest("/api/board/session", "POST", { password: submittedPassword }); setPassword(""); await refresh(); router.refresh(); }
    catch (error) { setFailure((error as Error).message); }
    finally { setPending(false); }
  }
  return <aside className="board-identity" aria-label="게시판 작성 권한">
    {loading ? <p role="status">게시판 권한을 확인하는 중...</p> : error ? <><p role="alert">{error}</p><button type="button" className="text-link" onClick={refresh}>다시 확인</button></>
      : !participant ? <button type="button" className="text-link" onClick={changeParticipant}>이름 선택하기</button>
        : viewer.isAdmin ? <p><strong>관리자</strong> · 공지사항과 전체 게시글을 관리할 수 있습니다.</p>
          : viewer.verified ? <p><strong>{participant.display_name}</strong> · 게시판 본인 확인 완료</p>
            : <><p><strong>{participant.display_name}</strong> 이름으로 글을 쓰려면 게시판 개인 비밀번호를 확인해주세요.</p>
              <form onSubmit={submit} method="post" className="board-identity-form" aria-busy={pending}>
                <label htmlFor={id}>게시판 개인 비밀번호</label>
                <input id={id} name="password" type="password" autoComplete="section-board current-password" value={password} onChange={(event) => { setPassword(event.target.value); setFailure(""); }} required maxLength={1024} placeholder="개인 비밀번호" disabled={pending}
                  aria-describedby={!viewer.configured ? `${id}-configuration` : undefined} />
                <button type="submit" className="interaction-button" disabled={pending}>{pending ? "확인 중..." : "본인 확인"}</button>
              </form>
              {!viewer.configured && <p id={`${id}-configuration`} className="form-note mt-3" role="status">{configurationMessages[viewer.configurationIssue ?? "not_configured"]} 게시글과 댓글은 그대로 읽을 수 있습니다.</p>}
            </>}
    {failure && <p className="form-error mt-3" role="alert">{failure}</p>}
  </aside>;
}
