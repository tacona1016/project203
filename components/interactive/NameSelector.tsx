"use client";

import { useParticipant } from "./ParticipantProvider";

export function NameSelector() {
  const { participant, isLoading, changeParticipant } = useParticipant();

  return (
    <div className="name-selector">
      {participant ? (
        <div className="name-current">
          <span>{participant.display_name}</span>
          <span aria-hidden="true">·</span>
          <button type="button" onClick={changeParticipant} aria-label="선택한 이름 변경" aria-haspopup="dialog">변경</button>
        </div>
      ) : (
        <button type="button" className="text-link" onClick={changeParticipant} disabled={isLoading} aria-haspopup="dialog">
          {isLoading ? "이름 확인 중..." : "이름 선택"}
        </button>
      )}
    </div>
  );
}
