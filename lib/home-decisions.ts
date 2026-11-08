import type { ContentLinkGroup } from "../data/content-links.ts";

// Only explicitly registered decision notice IDs qualify. Neither a title
// containing “결정” nor a closed Poll is evidence of a confirmed decision.
export function homeDecisionIds(groups: readonly ContentLinkGroup[]): string[] {
  return [...new Set(groups.flatMap(group => group.decisionPostIds))];
}

export function selectHomeDecisions<T extends { id: string | number; created_at: string }>(
  notices: readonly T[], groups: readonly ContentLinkGroup[],
): T[] {
  const allowed = new Set(homeDecisionIds(groups));
  return notices.filter(notice => allowed.has(String(notice.id)))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
      || (BigInt(b.id) > BigInt(a.id) ? 1 : BigInt(b.id) < BigInt(a.id) ? -1 : 0))
    .slice(0, 3);
}
