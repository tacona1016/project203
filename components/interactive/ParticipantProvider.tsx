"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { getActiveParticipant, getParticipants } from "@/lib/site-api";
import type { Participant } from "@/lib/supabase/types";
import { PARTICIPANT_STORAGE_KEY, readLegacyName, readSelection, saveSelection } from "@/lib/participant-storage";
import { ParticipantDialog } from "./ParticipantDialog";

type ParticipantContextValue = {
  participant: Participant | null;
  isLoading: boolean;
  changeParticipant: () => void;
  invalidateParticipant: () => void;
};

const ParticipantContext = createContext<ParticipantContextValue | null>(null);

export function useParticipant() {
  const value = useContext(ParticipantContext);
  if (!value) throw new Error("useParticipant requires ParticipantProvider.");
  return value;
}

export function ParticipantProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [requested, setRequested] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const requestId = useRef(0);
  const mustChoose = pathname === "/" && participant === null;
  const dialogOpen = mustChoose || requested;

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    try {
      const activeParticipants = await getParticipants();
      if (currentRequest !== requestId.current) return;
      const stored = readSelection();
      const legacyName = stored ? null : readLegacyName();
      const selected = activeParticipants.find((item) => stored ? item.id === stored.id : item.display_name === legacyName) ?? null;
      setParticipants(activeParticipants);
      setParticipant(selected);
      if ((stored || legacyName) && !selected) setRequested(true);
      setStorageWarning(!saveSelection(selected));
      setError(activeParticipants.length ? "" : "선택할 이름이 아직 준비되지 않았습니다. 잠시 후 다시 확인해주세요.");
    } catch {
      if (currentRequest === requestId.current) setError("이름 목록을 불러오지 못했습니다. 다시 시도해주세요.");
    } finally {
      if (currentRequest === requestId.current) setIsLoading(false);
    }
  }, []);

  const cancelRefresh = useCallback(() => { requestId.current++; }, []);

  useEffect(() => {
    void Promise.resolve().then(refresh);
    const onStorage = (event: StorageEvent) => {
      if (event.key === PARTICIPANT_STORAGE_KEY || event.key === null) void refresh();
    };
    const onFocus = () => { void refresh(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      cancelRefresh();
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, cancelRefresh]);

  async function selectParticipant(id: string) {
    const selected = await getActiveParticipant(id);
    if (!selected) {
      await refresh();
      throw new Error("현재 선택할 수 없는 이름입니다. 다른 이름을 선택해주세요.");
    }
    // 진행 중인 초기 조회가 방금 저장한 선택을 덮어쓰지 않도록 합니다.
    requestId.current++;
    setParticipant(selected);
    setStorageWarning(!saveSelection(selected));
    setIsLoading(false);
    setRequested(false);
  }

  function changeParticipant() {
    setRequested(true);
    void refresh();
  }

  function invalidateParticipant() {
    setParticipant(null);
    saveSelection(null);
    setRequested(true);
    void refresh();
  }

  return (
    <ParticipantContext value={{ participant, isLoading, changeParticipant, invalidateParticipant }}>
      <div inert={dialogOpen}>{children}</div>
      <ParticipantDialog
        open={dialogOpen}
        canDismiss={!mustChoose}
        participants={participants}
        currentId={participant?.id ?? ""}
        isLoading={isLoading}
        error={error}
        storageWarning={storageWarning}
        onSelect={selectParticipant}
        onRetry={refresh}
        onClose={() => setRequested(false)}
      />
    </ParticipantContext>
  );
}
