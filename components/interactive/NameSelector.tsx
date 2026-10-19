"use client";

import { useId, useState } from "react";
import { participants } from "@/data/participants";
import { selectParticipant, useSelectedParticipant } from "@/lib/useSelectedParticipant";

export function NameSelector() {
  const selectedName = useSelectedParticipant();
  const [editing, setEditing] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const id = useId();

  return (
    <div className="name-selector">
      {selectedName && !editing ? (
        <div className="name-current">
          <span>{selectedName}</span>
          <span aria-hidden="true">·</span>
          <button type="button" onClick={() => setEditing(true)} aria-label="선택한 이름 변경">변경</button>
        </div>
      ) : (
        <>
          <label htmlFor={id} className="sr-only">이름 선택</label>
          <select
            id={id}
            value={selectedName ?? ""}
            onChange={(event) => {
              setStorageWarning(!selectParticipant(event.target.value));
              setEditing(false);
            }}
          >
            <option value="" disabled>이름을 선택해주세요</option>
            {participants.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </>
      )}
      {storageWarning && <p role="status" className="form-note">이 브라우저에서는 이름이 다음 방문까지 저장되지 않습니다.</p>}
    </div>
  );
}
