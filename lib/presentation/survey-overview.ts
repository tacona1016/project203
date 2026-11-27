import { parseAllocation, REVIEW_POLL_IDS } from "./poll-analysis.ts";
import type { ScoreItem } from "./poll-analysis.ts";
import type { PollData, PollOption, PollSummary } from "../supabase/types.ts";

export type SurveyOverview = ReturnType<typeof buildSurveyOverview>;
const percent = (n: number, total: number) => total ? Math.round(n / total * 1000) / 10 : 0;
function requireValue(value: unknown): asserts value { if (!value) throw new Error("SURVEY_DATA_UNAVAILABLE"); }

/** An all-or-nothing publication gate; never turn private/missing outcomes into zero. */
export function publicSurveyTargets(catalog: PollSummary[]): PollSummary[] | null {
  const targets = REVIEW_POLL_IDS.map(id => catalog.find(item => String(item.poll.id) === String(id)));
  if (targets.some(item => !item || item.poll.quarter !== "2026-q4" || item.poll.is_hidden || item.status === "HIDDEN" || !item.results || !(item.poll.results_visibility === "live" || item.poll.results_visibility === "after_close" && item.status === "CLOSED"))) return null;
  return targets as PollSummary[];
}

/** Raw identities/text never leave this function. The numbered format preserves original scores. */
export function summarizeAllocation(responses: NonNullable<PollData["responses"]>) {
  const identities = new Set<string>();
  const valid: number[][] = [];
  for (const response of responses) {
    requireValue(response.participant_id && !identities.has(response.participant_id));
    identities.add(response.participant_id);
    const scores = parseAllocation(response.text_response ?? "");
    if (scores) valid.push(scores);
  }
  const labels = ["거리(접근성)", "토지 넓이", "주변 환경", "건축시기"];
  const items: ScoreItem[] = valid.length ? labels.map((label, index) => {
    const values = valid.map(row => row[index]).sort((a, b) => a - b);
    const mean = values.reduce((sum, n) => sum + n, 0) / values.length;
    return { item: index + 1, label, mean, median: (values[Math.floor((values.length - 1) / 2)] + values[Math.ceil((values.length - 1) / 2)]) / 2,
      minimum: values[0], maximum: values.at(-1)!, valid_n: values.length,
      population_standard_deviation: Math.sqrt(values.reduce((sum, n) => sum + (n - mean) ** 2, 0) / values.length),
      distribution: Object.fromEntries([1, 2, 3, 4].map(n => [n, values.filter(value => value === n).length])) };
  }) : [];
  return { valid_count: valid.length, invalid_count: responses.length - valid.length, items };
}

/** Build only public aggregates from the existing policy-filtered RPCs. */
export function buildSurveyOverview(catalog: PollSummary[], options: PollOption[], detail: PollData) {
  const targets = publicSurveyTargets(catalog);
  requireValue(targets);
  const registered = targets[0].results!.eligible_participant_count;
  requireValue(Number.isInteger(registered) && registered! > 0);
  const snapshot = targets[0].server_time;
  requireValue(Number.isFinite(Date.parse(snapshot)) && targets.every(item => item.server_time === snapshot));
  const scoreTarget = targets.find(item => String(item.poll.id) === "11")!;
  requireValue(detail && JSON.stringify(detail.poll) === JSON.stringify(scoreTarget.poll) && detail.results && detail.responses && detail.poll.poll_type === "text");
  requireValue(publicSurveyTargets(targets.map(item => String(item.poll.id) === "11" ? { ...detail, results: detail.results } : item)));
  const allocation = summarizeAllocation(detail.responses);
  const polls = targets.map(({ poll, results }) => {
    const respondents = results!.participant_count;
    requireValue(Number.isInteger(respondents) && respondents >= 0 && respondents <= registered!);
    requireValue(results!.eligible_participant_count === registered);
    if (String(poll.id) === "11") {
      requireValue(detail.responses!.length === respondents && results!.total_votes === detail.responses!.length);
    } else requireValue(poll.poll_type === "choice");
    const rows = poll.poll_type === "choice" ? options.filter(option => String(option.poll_id) === String(poll.id)).sort((a, b) => a.display_order - b.display_order) : [];
    requireValue(poll.poll_type !== "choice" || rows.length >= 2 && rows.length <= 20 && new Set(rows.map(row => String(row.id))).size === rows.length);
    const counts = results!.counts;
    requireValue(Object.entries(counts).every(([id, count]) => rows.some(row => String(row.id) === id) && Number.isInteger(count) && count >= 0 && count <= respondents));
    const mapped = rows.map(option => ({ id: String(option.id), label: option.label, count: counts[String(option.id)] ?? 0 }));
    const sum = mapped.reduce((total, row) => total + row.count, 0);
    if (poll.poll_type === "choice") requireValue(sum === results!.total_votes && (poll.vote_mode === "single" ? sum === respondents : sum >= respondents && sum <= respondents * (poll.max_choices_per_participant ?? rows.length)));
    return { id: Number(poll.id), respondents, participation_percentage: percent(respondents, registered!),
      max_choices_per_participant: poll.max_choices_per_participant,
      options: mapped.map(row => ({ ...row, percentage: percent(row.count, respondents), rank: 1 + mapped.filter(other => other.count > row.count).length })),
      allocation: String(poll.id) === "11" ? allocation : null };
  });
  return { audience: { registered: registered! }, snapshot_at_utc: snapshot,
    snapshot_at_kst: new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "medium" }).format(new Date(snapshot)) + " KST", polls };
}
