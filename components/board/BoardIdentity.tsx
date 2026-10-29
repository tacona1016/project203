"use client";
import { useParticipant } from "@/components/interactive/ParticipantProvider";
import { useBoard } from "./BoardProvider";
export function BoardIdentity() {
  const { participant } = useParticipant();
  const { viewer, loading, error, refresh } = useBoard();
  return <aside className="board-identity" aria-label="게시판 작성 권한">
    {loading ? <p role="status">게시판 권한을 확인하는 중...</p> : error ? <><p role="alert">{error}</p><button type="button" className="text-link" onClick={refresh}>다시 확인</button></>
      : <p><strong>{participant.display_name}</strong> · {viewer.isAdmin ? "관리자 권한으로 게시판을 이용합니다." : "로그인한 회원으로 게시판을 이용합니다."}</p>}
  </aside>;
}
