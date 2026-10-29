"use client";

export async function boardRequest<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, { method, credentials: "same-origin", cache: "no-store",
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
  if (response.status === 401) {
    window.location.replace(`/access?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    throw new Error("회원 로그인이 필요합니다.");
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "요청을 처리하지 못했습니다. 다시 시도해주세요.");
  return result as T;
}
