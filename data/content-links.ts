// Add relationships only after a real discussion/decision. Empty by default.
// IDs refer to existing Board notices; presentation content remains in MDX.
export type ContentLinkGroup = { quarter: string; pollSlugs: readonly string[]; decisionPostIds: readonly string[] };
export const contentLinks: readonly ContentLinkGroup[] = [];

export function validContentLinks(groups: readonly ContentLinkGroup[], quarters: readonly { slug: string }[]) {
  return groups.filter(group => quarters.some(quarter => quarter.slug === group.quarter)).map(group => ({
    quarter: group.quarter,
    pollSlugs: [...new Set(group.pollSlugs.filter(slug => /^[a-z0-9][a-z0-9-]{0,119}$/.test(slug)))],
    decisionPostIds: [...new Set(group.decisionPostIds.filter(id => /^[1-9]\d{0,17}$/.test(id)))],
  }));
}
