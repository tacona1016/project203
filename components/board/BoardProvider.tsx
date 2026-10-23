"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useParticipant } from "@/components/interactive/ParticipantProvider";
import { boardRequest } from "@/lib/board/client";
import type { BoardViewer } from "@/lib/board/types";

const empty: BoardViewer = { participantId: null, isAdmin: false, verified: false, configured: false };
const Context = createContext<{ viewer: BoardViewer; loading: boolean; error: string; refresh: () => Promise<void> } | null>(null);
export function useBoard() { const value = useContext(Context); if (!value) throw new Error("BoardProvider required"); return value; }
export function BoardProvider({ children }: { children: ReactNode }) {
  const { participant } = useParticipant();
  const [state, setState] = useState<{ viewer: BoardViewer; participantId: string | null; loading: boolean; error: string }>({ viewer: empty, participantId: null, loading: true, error: "" });
  const id = participant?.id ?? null;
  const refresh = useCallback(async () => {
    try { const viewer = await boardRequest<BoardViewer>("/api/board/session"); setState({ viewer, participantId: id, loading: false, error: "" }); }
    catch { setState({ viewer: empty, participantId: id, loading: false, error: "게시판 권한을 확인하지 못했습니다. 다시 시도해주세요." }); }
  }, [id]);
  useEffect(() => {
    let current = true;
    const load = async () => {
      try { const viewer = await boardRequest<BoardViewer>("/api/board/session"); if (current) setState({ viewer, participantId: id, loading: false, error: "" }); }
      catch { if (current) setState({ viewer: empty, participantId: id, loading: false, error: "게시판 권한을 확인하지 못했습니다. 다시 시도해주세요." }); }
    };
    void load(); window.addEventListener("focus", load);
    return () => { current = false; window.removeEventListener("focus", load); };
  }, [id]);
  const matches = state.participantId === id;
  return <Context value={{ viewer: matches ? state.viewer : empty, loading: !matches || state.loading, error: state.error, refresh }}>{children}</Context>;
}
