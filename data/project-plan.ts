export type ProjectEvent = {
  id: string;
  title: string;
  /** ISO date/time with an explicit Z or UTC offset; displayed in Asia/Seoul. */
  startsAt: string;
  location?: string;
  description?: string;
  /** Optional link to an existing protected project page. */
  href?: string | null;
};

// Planning targets from the 2026 Q4 presentation, not actual completion dates.
export const projectRoadmap = [
  { phase: "01", title: "토지 구매", target: "2027–2028년", description: "건축 가능한 토지를 검토하고 매입 범위를 좁힙니다." },
  { phase: "02", title: "토목·인프라 공사", target: "2030년까지", description: "도로·전기·물·오수 등 실제 이용 여건을 마련합니다." },
  { phase: "03", title: "별장 설계·건축", target: "2035년까지", description: "토지와 자금 여건을 다시 확인한 뒤 건축을 준비합니다." },
] as const;

// Add confirmed meetings/site visits only. Do not invent an operational schedule.
// Poll deadlines are shown separately from the database-backed Poll catalog.
export const projectEvents: readonly ProjectEvent[] = [];

export function projectEventHref(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return null;
  try {
    const url = new URL(value, "https://project203.invalid");
    const pathname = decodeURIComponent(url.pathname);
    if (url.origin !== "https://project203.invalid" || pathname.includes("//") || /[\\\u0000-\u0020]/.test(pathname)
      || !/^\/(?:board|polls|quarter|archive)(?:\/|$)/.test(pathname)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return null; }
}

export function validProjectEvent(event: ProjectEvent): boolean {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(event.id) || !event.title.trim() || event.title.length > 160
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(event.startsAt)) return false;
  const day = new Date(`${event.startsAt.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== event.startsAt.slice(0, 10)
    || !Number.isFinite(Date.parse(event.startsAt))) return false;
  return event.href == null || projectEventHref(event.href) !== null;
}

export function getUpcomingProjectEvents(entries: readonly ProjectEvent[] = projectEvents, now = Date.now()): ProjectEvent[] {
  if (!Number.isFinite(now)) return [];
  return entries.filter(event => validProjectEvent(event) && Date.parse(event.startsAt) >= now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id))
    .slice(0, 3);
}
