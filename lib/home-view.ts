import type { PollSummary } from "./supabase/types";

/** Presentation-only ordering; availability and private results stay server-owned. */
export function selectHomePolls(items: readonly PollSummary[]) {
  const rank = (item: PollSummary) => item.ownParticipation?.hasParticipated === false ? 0 : item.ownParticipation?.hasParticipated === true ? 2 : 1;
  const deadline = (item: PollSummary) => item.poll.voting_ends_at ? Date.parse(item.poll.voting_ends_at) : Infinity;
  return items.filter(item => item.status === "ACTIVE" && !item.poll.is_hidden).sort((left, right) => {
    const participation = rank(left) - rank(right);
    if (participation) return participation;
    const leftEnd = deadline(left), rightEnd = deadline(right);
    if (leftEnd !== rightEnd) return leftEnd - rightEnd;
    return right.poll.created_at.localeCompare(left.poll.created_at) || left.poll.slug.localeCompare(right.poll.slug);
  }).slice(0, 3);
}
