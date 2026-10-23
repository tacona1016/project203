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
      window.location.replace(admin ? "/admin" : "/access");
    } catch { setError("잠그지 못했습니다. 다시 시도해주세요."); setPending(false); }
  }
  return <div className="text-right">
    <button type="button" className="lock-site-button" onClick={lock} disabled={pending}>{pending ? "잠그는 중..." : admin ? "관리자 잠그기" : "사이트 잠그기"}</button>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
