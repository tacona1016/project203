"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LikeState } from "@/lib/board/types";
import { useBoard } from "./BoardProvider";

export function BoardLikeButton({ url, initial }: { url: string; initial?: LikeState | null }) {
  const { viewer, loading } = useBoard();
  const [value, setValue] = useState(initial ?? null), [pending, setPending] = useState(false), [uncertain, setUncertain] = useState(false), [error, setError] = useState("");
  const busy = useRef(false);
  const router = useRouter();
  function confirmed(value: LikeState) {
    setValue(value);
    // Next's refresh invalidates its dynamic back/forward cache. Do this only
    // for post likes after a server acknowledgement (including reconciliation).
    if (/^\/api\/board\/posts\/\d+\/like$/.test(url)) router.refresh();
  }
  useEffect(() => { if (!busy.current) setValue(initial ?? null); }, [initial?.count, initial?.liked, initial]);
  async function request(method: string) {
    const response = await fetch(url, { method, credentials: "same-origin", cache: "no-store" });
    if (response.status === 401) window.location.replace(`/access?next=${encodeURIComponent(window.location.pathname)}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "좋아요를 저장하지 못했습니다.");
    if (!Number.isInteger(result.count) || result.count < 0 || typeof result.liked !== "boolean") throw new Error("좋아요 상태를 확인하지 못했습니다.");
    return result as LikeState;
  }
  async function click() {
    if (busy.current || loading || !viewer.verified) return;
    busy.current = true; setPending(true); setError("");
    const before = value;
    try {
      if (!before || uncertain) { confirmed(await request("GET")); setUncertain(false); return; }
      setValue({ count: Math.max(0, before.count + (before.liked ? -1 : 1)), liked: !before.liked });
      try { confirmed(await request(before.liked ? "DELETE" : "PUT")); }
      catch (failure) {
        setValue(before);
        try { confirmed(await request("GET")); setError("최신 좋아요 상태를 다시 확인했습니다."); }
        catch { setUncertain(true); setError(failure instanceof Error ? failure.message : "상태를 확인하지 못했습니다. 다시 확인해주세요."); }
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "좋아요를 불러오지 못했습니다."); }
    finally { busy.current = false; setPending(false); }
  }
  return <div className="board-like-control">
    <button type="button" className={`board-like-button ${value?.liked ? "is-liked" : ""}`} aria-pressed={value?.liked ?? false} aria-busy={pending} disabled={loading || !viewer.verified || pending} onClick={click}>
      <span aria-hidden="true">{value?.liked ? "♥" : "♡"}</span> {uncertain ? "상태 확인" : value ? `좋아요 ${value.count}` : "좋아요 불러오기"}
    </button>
    {error && <p className="form-note mt-2" role="status">{error}</p>}
  </div>;
}
