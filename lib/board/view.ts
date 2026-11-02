import { boardPage, boardSearch } from "./validation.ts";

export function boardReturnTo(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048 || /[\\\u0000-\u0020]/.test(value)) return "/board";
  try {
    const url = new URL(value, "https://project203.invalid");
    if (url.origin !== "https://project203.invalid" || url.pathname !== "/board" || url.hash) return "/board";
    const q = boardSearch(url.searchParams.get("q")), page = boardPage(url.searchParams.get("page"));
    const query = new URLSearchParams({ ...(q ? { q } : {}), ...(page > 1 ? { page: String(page) } : {}) });
    const encoded = query.toString();
    return encoded ? `/board?${encoded}` : "/board";
  } catch { return "/board"; }
}

export function boardPostHref(id: string | number, returnTo: string, suffix = "") {
  const query = new URLSearchParams({ returnTo: boardReturnTo(returnTo) });
  return `/board/${id}${suffix}?${query}`;
}

/** Recent means created in the last seven days, not unread by this member. */
export function isRecentBoardPost(createdAt: string, now = Date.now()) {
  const time = Date.parse(createdAt);
  return Number.isFinite(time) && time <= now && now - time < 7 * 86400000;
}
