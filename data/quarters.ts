import type { Metadata } from "next";

export type Quarter = {
  slug: string;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  title: string;
  description: string;
  /** ISO date (YYYY-MM-DD). The most recently published entry is Current. */
  publishedAt: string;
};

export const quarters: readonly Quarter[] = [
  {
    slug: "2026-q4",
    year: 2026,
    quarter: 4,
    title: "방향 전환과 토지 검토 기준",
    description: "시골 아파트 전세에서 건축 가능한 토지로. 10명의 친구가 Phase 1의 범위를 좁히는 12장짜리 의사결정 프레임워크입니다.",
    publishedAt: "2026-10-19",
  },
];

export function getSortedQuarters(entries: readonly Quarter[] = quarters): Quarter[] {
  return [...entries].sort(
    (a, b) =>
      b.publishedAt.localeCompare(a.publishedAt) ||
      b.year - a.year ||
      b.quarter - a.quarter,
  );
}

export function getCurrentQuarter(entries: readonly Quarter[] = quarters): Quarter | undefined {
  return getSortedQuarters(entries)[0];
}

export function getArchivedQuarters(entries: readonly Quarter[] = quarters): Quarter[] {
  return getSortedQuarters(entries).slice(1);
}

export function findQuarter(slug: string): Quarter | undefined {
  return quarters.find((entry) => entry.slug === slug);
}

export function getQuarterLabel(quarter: Pick<Quarter, "year" | "quarter">): string {
  return `${quarter.year} Q${quarter.quarter}`;
}

// Pass only these fields to authenticated admin forms, not the presentation metadata.
export function getQuarterChoices() {
  const current = getCurrentQuarter();
  return getSortedQuarters().map((quarter) => ({ slug: quarter.slug, label: getQuarterLabel(quarter), current: quarter.slug === current?.slug }));
}

export function getQuarter(slug: string): Quarter {
  const quarter = findQuarter(slug);

  if (!quarter) {
    throw new Error(`Add metadata for "${slug}" to data/quarters.ts.`);
  }

  return quarter;
}

export function getQuarterMetadata(quarter: Quarter): Metadata {
  return {
    title: `${quarter.year} Q${quarter.quarter} — ${quarter.title}`,
    description: quarter.description,
  };
}
