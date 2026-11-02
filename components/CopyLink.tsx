"use client";

import { useRef, useState, useSyncExternalStore } from "react";
const subscribe = () => () => {};

export function CopyLink({ label = "링크 복사" }: { label?: string }) {
  const [message, setMessage] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const manual = useRef<HTMLInputElement>(null);
  const copying = useRef(false);
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  async function copy() {
    if (copying.current) return;
    copying.current = true;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(window.location.href);
      setManualUrl(""); setMessage("링크를 복사했습니다.");
    } catch {
      setManualUrl(window.location.href);
      setMessage("자동 복사가 지원되지 않습니다. 아래 링크를 선택해 복사해주세요.");
    } finally { copying.current = false; }
  }
  return <div className="copy-link-control">
    <button type="button" className="text-link" onClick={copy} disabled={!ready}>{label}</button>
    {message && <p className="form-note mt-2" role="status">{message}</p>}
    {manualUrl && <input ref={manual} type="url" readOnly value={manualUrl} className="copy-link-input" aria-label="복사할 링크" onFocus={() => manual.current?.select()} onClick={() => manual.current?.select()} />}
  </div>;
}
