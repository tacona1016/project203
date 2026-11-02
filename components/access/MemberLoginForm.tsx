"use client";
import { useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { loginFailureMessage } from "@/lib/auth/login-feedback";

type Member = { id: string; display_name: string };
const subscribe = () => () => {};
export function MemberLoginForm({ returnTo, members }: { returnTo: string; members: Member[] | null }) {
  const id = useId();
  // Prevent a native HTML POST before the JSON login handler has hydrated.
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const submitting = useRef(false);
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!ready || submitting.current) return;
    // FormData includes password-manager changes without relying on React state.
    const form = new FormData(event.currentTarget);
    const participantId = form.get("participantId"), password = form.get("password");
    submitting.current = true; setPending(true); setError("");
    try {
      const response = await fetch("/api/access", { method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ participantId, password, next: returnTo }) });
      if (!response.ok) { setError(loginFailureMessage(response.status, response.headers.get("Retry-After"))); return; }
      const result = await response.json();
      if (typeof result?.redirectTo !== "string") throw new Error("Unexpected login response");
      if (typeof BroadcastChannel !== "undefined") { const channel = new BroadcastChannel("project203_auth"); channel.postMessage("changed"); channel.close(); }
      window.location.replace(result.redirectTo);
    } catch { setError("로그인하지 못했습니다. 잠시 후 다시 시도해주세요."); }
    finally { submitting.current = false; setPending(false); }
  }
  return <form onSubmit={submit} method="post" className="mt-10" aria-busy={pending}>
    <label htmlFor={`${id}-name`} className="mb-3 block text-sm">이름</label>
    <select id={`${id}-name`} name="participantId" autoComplete="section-member username" className="participant-select" defaultValue="" required disabled={!ready || pending || !members?.length}>
      <option value="" disabled>이름을 선택해주세요</option>
      {members?.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}
    </select>
    <label htmlFor={`${id}-password`} className="mb-3 mt-6 block text-sm">개인 비밀번호</label>
    <input id={`${id}-password`} name="password" type="password" autoComplete="section-member current-password" className="access-input"
      required disabled={!ready || pending || !members?.length} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} />
    <button type="submit" className="interaction-button mt-5 w-full" disabled={!ready || pending || !members?.length}>{pending ? "확인 중..." : "로그인"}</button>
    {!members?.length && <p role="status" className="form-note mt-5">이름 목록을 불러오지 못했습니다. 잠시 후 새로고침해주세요.</p>}
    {error && <p id={`${id}-error`} className="form-error mt-5" role="alert">{error}</p>}
  </form>;
}
