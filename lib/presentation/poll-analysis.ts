export const REVIEW_POLL_IDS = [1, 9, 10, 11, 12, 13, 14] as const;
export type ResultOption = { id: number; label: string; display_order: number; count: number; percentage?: number; rank?: number };
export type ScoreItem = { item: number; label: string; mean: number; median: number; minimum: number; maximum: number; valid_n: number; population_standard_deviation: number; distribution: Record<string, number> };
export type ReviewPoll = {
  id: number; slug: string; title: string; poll_type: "choice" | "text"; vote_mode: "single" | "multiple";
  status: string; visible: boolean; is_closed: boolean; is_hidden: boolean; results_visibility: string;
  voting_ends_at: string | null; respondents: number | null; raw_response_count: number | null;
  max_choices_per_participant: number | null; options: ResultOption[] | null;
  allocation: { valid_count: number; invalid_count: number; duplicate_respondent_count: number; format_counts?: Record<string, number>; items: ScoreItem[] } | null;
  validation: { wrong_option_rows: number; duplicate_active_rows: number; over_limit_respondents: number } | null;
  participation_percentage?: number; leaders?: string[];
};
export type PollSnapshot = {
  snapshot_at_utc: string; snapshot_at_kst: string; target_ids: number[];
  audience: { registered: number; active: number; denominator: string }; polls: ReviewPoll[];
};
const percent = (n: number, total: number) => total ? Math.round(n / total * 1000) / 10 : 0;
function ensure(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

export function analyzeSnapshot<T extends PollSnapshot>(source: T): T {
  const data = structuredClone(source);
  ensure(Number.isFinite(Date.parse(data.snapshot_at_utc)), "Invalid server snapshot time");
  ensure(data.polls.length === 7 && JSON.stringify(data.polls.map(p => p.id).sort((a,b) => a-b)) === JSON.stringify(REVIEW_POLL_IDS), "Exactly the seven approved poll IDs are required");
  ensure(JSON.stringify([...data.target_ids].sort((a,b) => a-b)) === JSON.stringify(REVIEW_POLL_IDS), "Snapshot target metadata differs");
  ensure(Number.isInteger(data.audience.registered) && data.audience.registered > 0, "Registered-member denominator missing");
  for (const p of data.polls) {
    ensure(p.results_visibility === "live" || p.results_visibility === "after_close", "Unknown result publication policy");
    const visible = !p.is_hidden && (p.results_visibility === "live" || p.is_closed || p.voting_ends_at !== null && Date.parse(p.voting_ends_at) <= Date.parse(data.snapshot_at_utc));
    ensure(p.visible === visible, "Result publication policy mismatch");
    if (!visible) { ensure(p.respondents === null && p.raw_response_count === null && p.options === null && p.allocation === null, "Private results must be withheld, not zeroed"); continue; }
    ensure(Number.isInteger(p.respondents) && p.respondents! >= 0 && p.respondents! <= data.audience.registered, "Invalid respondent count");
    p.participation_percentage = percent(p.respondents!, data.audience.registered);
    if (p.poll_type === "choice") {
      ensure(p.validation && Object.values(p.validation).every(value => value === 0), "Invalid or duplicate canonical selections");
      ensure(p.options && new Set(p.options.map(o => o.id)).size === p.options.length, "Duplicate option IDs");
      const sum = p.options.reduce((n, o) => n + o.count, 0);
      ensure(sum === p.raw_response_count, "Option totals differ from canonical selected rows");
      ensure(p.vote_mode === "multiple" ? sum >= p.respondents! && sum <= p.respondents! * (p.max_choices_per_participant ?? p.options.length) : sum === p.respondents, "Ballot cardinality mismatch");
      for (const o of p.options) {
        ensure(Number.isInteger(o.count) && o.count >= 0 && o.count <= p.respondents!, "Invalid option count");
        o.percentage = percent(o.count, p.respondents!);
        o.rank = 1 + p.options.filter(other => other.count > o.count).length;
      }
      p.leaders = p.options.filter(o => o.rank === 1 && o.count > 0).map(o => o.label);
    } else {
      const a = p.allocation;
      ensure(a && a.valid_count + a.invalid_count === p.respondents && a.duplicate_respondent_count === 0, "Text respondent validity mismatch");
      if (a.format_counts) ensure(Object.entries(a.format_counts).every(([format, n]) => ["plain", "numbered_items"].includes(format) && Number.isInteger(n) && n >= 0) && Object.values(a.format_counts).reduce((sum,n) => sum+n,0) === a.valid_count, "Score format counts mismatch");
      ensure(a.items.length === (a.valid_count ? 4 : 0), "Exactly four score positions are required");
      ensure(!a.valid_count || JSON.stringify(a.items.map(item => item.item)) === "[1,2,3,4]", "Score positions must remain in question order");
      for (const item of a.items) {
        ensure(Object.entries(item.distribution).every(([score, n]) => /^[1-4]$/.test(score) && Number.isInteger(n) && n >= 0 && n <= a.valid_count), "Invalid score distribution");
        const values = [1, 2, 3, 4].flatMap(score => Array.from({ length: item.distribution[score] ?? 0 }, () => score));
        ensure(values.length === a.valid_count && item.valid_n === a.valid_count, "Score distribution denominator mismatch");
        const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
        const median = (values[Math.floor((values.length - 1) / 2)] + values[Math.ceil((values.length - 1) / 2)]) / 2;
        const sd = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
        ensure(Math.abs(mean - item.mean) < 0.00011 && median === item.median && Math.abs(sd - item.population_standard_deviation) < 0.00011, "SQL statistics disagree with independent distribution calculation");
        ensure(Math.min(...values) === item.minimum && Math.max(...values) === item.maximum, "Score range mismatch");
      }
      ensure(!a.valid_count || Math.abs(a.items.reduce((sum, item) => sum + item.mean, 0) - 10) < 0.001, "Valid score means must sum to ten");
    }
  }
  return data;
}

/** No automatic repair, and no inferred semantic labels from another deck. */
export function parseAllocation(text: string): number[] | null {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const numbered = lines.map(line => line.match(/^([1-4])[.)]\s+([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/));
  // Only a complete, explicit 1..4 list identifies question numbers as labels.
  // Never discard arbitrary extra numbers or repair an invalid score/sum.
  const hasNumberedItems = lines.length === 4 && numbered.every(match => match !== null) && new Set(numbered.map(match => match![1])).size === 4;
  const tokens = hasNumberedItems ? numbered.map(match => match!).sort((a,b) => Number(a[1])-Number(b[1])).map(match => match[2]) : text.match(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)/g) ?? [];
  if (tokens.length !== 4 || tokens.some(n => !/^[1-4]$/.test(n))) return null;
  const values = tokens.map(Number);
  return values.reduce((sum, value) => sum + value, 0) === 10 ? values : null;
}
