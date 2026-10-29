"use client";
import { createContext, useCallback, useContext, useEffect, type ReactNode } from "react";

type Member = { id: string; display_name: string };
const Context = createContext<Member | null>(null);
export function useParticipant() {
  const participant = useContext(Context);
  if (!participant) throw new Error("Authenticated member required.");
  return { participant, isLoading: false, invalidateParticipant: () => window.location.replace("/access") };
}

// Display only. Every API derives identity and permissions from the server session.
export function ParticipantProvider({ participant, children }: { participant: Member; children: ReactNode }) {
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/access/session", { credentials: "same-origin", cache: "no-store" });
      if (response.status === 401) { window.location.replace(`/access?next=${encodeURIComponent(location.pathname + location.search)}`); return; }
      if (!response.ok) return;
      const result = await response.json();
      if (result.participant?.id !== participant.id || result.participant?.display_name !== participant.display_name) window.location.reload();
    } catch { /* A network interruption does not change server authorization. */ }
  }, [participant.id, participant.display_name]);
  useEffect(() => {
    const onFocus = () => { void refresh(); };
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("project203_auth");
    if (channel) channel.onmessage = onFocus;
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus);
    return () => { channel?.close(); window.removeEventListener("focus", onFocus); window.removeEventListener("pageshow", onFocus); };
  }, [refresh]);
  return <Context value={participant}>{children}</Context>;
}
