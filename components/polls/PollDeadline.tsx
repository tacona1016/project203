"use client";

import { useEffect, useState } from "react";
import type { PollRecord, PollStatus } from "@/lib/supabase/types";
import { pollDeadline } from "@/lib/poll-view";

export function PollDeadline({ poll, status, serverTime, compact = false }: { poll: Pick<PollRecord, "voting_starts_at" | "voting_ends_at">; status: PollStatus; serverTime: string; compact?: boolean }) {
  const [clock, setClock] = useState({ source: serverTime, elapsed: 0 });
  useEffect(() => {
    if (status !== "ACTIVE" && status !== "UPCOMING" || !poll.voting_starts_at && !poll.voting_ends_at) return;
    const started = performance.now();
    const timer = window.setInterval(() => setClock({ source: serverTime, elapsed: performance.now() - started }), 60_000);
    return () => window.clearInterval(timer);
  }, [poll.voting_ends_at, poll.voting_starts_at, serverTime, status]);
  const now = new Date(new Date(serverTime).getTime() + (clock.source === serverTime ? clock.elapsed : 0));
  const label = Number.isFinite(now.getTime()) ? pollDeadline(poll, status, now.toISOString()) : null;
  return label ? <p className={`poll-deadline text-accent${compact ? "" : " mt-3 text-sm"}`}>{label}<span className="sr-only">. 서버 시각 기준 안내이며 실제 투표 가능 여부는 제출 시 확인합니다.</span></p> : null;
}
