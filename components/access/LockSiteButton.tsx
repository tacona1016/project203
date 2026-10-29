"use client";

import { useState } from "react";

export function LockSiteButton({ admin = false }: { admin?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function lock() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(admin ? "/api/admin/access/lock" : "/api/access/lock", { method: "POST", credentials: "same-origin", cache: "no-store" });
      if (!response.ok && response.status !== 401) throw new Error();
      if (!admin && typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel("project203_auth"); channel.postMessage("changed"); channel.close();
      }
      window.location.replace(admin ? "/admin" : "/access");
    } catch { setError("로그아웃하지 못했습니다. 다시 시도해주세요."); setPending(false); }
  }
  return <div className="text-right">
    <button type="button" className="lock-site-button" onClick={lock} disabled={pending}>{pending ? "처리 중..." : admin ? "관리자 잠그기" : "로그아웃"}</button>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
