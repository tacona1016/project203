"use client";

import { useId, useState, type FormEvent } from "react";

export function AccessForm({ returnTo, configured, endpoint = "/api/access", admin = false }: { returnTo: string; configured: boolean; endpoint?: string; admin?: boolean }) {
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const id = useId();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    // Autofill/password managers can update the DOM without updating React state.
    const submittedPassword = new FormData(event.currentTarget).get("password");
    if (typeof submittedPassword !== "string" || !submittedPassword) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: submittedPassword, next: returnTo }), credentials: "same-origin", cache: "no-store",
      });
      const result = await response.json();
      setPassword("");
      if (!response.ok) { setError(result.error || "확인에 실패했습니다. 다시 시도해주세요."); return; }
      // A full navigation discards any previous protected RSC/client cache.
      window.location.replace(result.redirectTo);
    } catch { setError("확인에 실패했습니다. 다시 시도해주세요."); }
    finally { setPending(false); }
  }

  return (
    <form onSubmit={submit} method="post" className="mt-10" aria-busy={pending}>
      <label htmlFor={id} className="mb-3 block text-sm">{admin ? "관리자 비밀번호" : "공용 비밀번호"}</label>
      <input id={id} type="password" name="password" value={password} required maxLength={1024}
        autoComplete={`${admin ? "section-admin" : "section-site"} current-password`} className="access-input" disabled={pending || !configured}
        aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => setPassword(event.target.value)} />
      <button type="submit" className="interaction-button mt-5 w-full" disabled={pending || !configured}>
        {pending ? "확인 중..." : "입장하기"}
      </button>
      {!configured && <p className="form-note mt-5" role="status">접근 설정을 준비하고 있습니다. 잠시 후 다시 방문해주세요.</p>}
      {error && <p id={`${id}-error`} className="form-error mt-5" role="alert">{error}</p>}
    </form>
  );
}
