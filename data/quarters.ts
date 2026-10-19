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
    title: "Quarterly Presentation",
    description: "이번 분기의 흐름을 돌아보고, 다음을 위한 방향을 함께 살펴봅니다.",
    publishedAt: "2026-10-19",
  },
];

export function getSortedQuarters(): Quarter[] {
  return [...quarters].sort(
    (a, b) =>
      b.publishedAt.localeCompare(a.publishedAt) ||
      b.year - a.year ||
      b.quarter - a.quarter,
  );
}

export function getQuarter(slug: string): Quarter {
  const quarter = quarters.find((entry) => entry.slug === slug);

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
