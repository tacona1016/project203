// Add relationships only after a real discussion/decision. Empty by default.
// IDs refer to confirmed, existing Board notices; presentation content stays in MDX.
// Register only final agreements in decisionPostIds. Home also uses these IDs
// to show the three most recently registered decision notices. Removing an ID
// stops featuring a superseded decision without deleting its Board history.
export type ContentLinkGroup = { quarter: string; pollSlugs: readonly string[]; decisionPostIds: readonly string[] };
export const contentLinks: readonly ContentLinkGroup[] = [];

export function validContentLinks(groups: readonly ContentLinkGroup[], quarters: readonly { slug: string }[]) {
  return groups.filter(group => quarters.some(quarter => quarter.slug === group.quarter)).map(group => ({
    quarter: group.quarter,
    pollSlugs: [...new Set(group.pollSlugs.filter(slug => /^[a-z0-9][a-z0-9-]{0,119}$/.test(slug)))],
    decisionPostIds: [...new Set(group.decisionPostIds.filter(id => /^[1-9]\d{0,17}$/.test(id)))],
  }));
}
