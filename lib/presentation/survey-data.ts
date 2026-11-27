import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getPollCatalog } from "@/lib/supabase/queries";
import { buildSurveyOverview, publicSurveyTargets, type SurveyOverview } from "./survey-overview";

export type SurveyState = { status: "ready"; data: SurveyOverview } | { status: "withheld" | "unavailable" };

export async function getSurveyOverview(): Promise<SurveyState> {
  const client = await getSupabaseServerClient();
  if (!client) return { status: "unavailable" };
  try {
    const initial = await client.rpc("get_poll_catalog", { p_include_hidden: false });
    if (initial.error || !initial.data) throw new Error("SURVEY_CATALOG_UNAVAILABLE");
    const targets = publicSurveyTargets(initial.data);
    if (!targets) return { status: "withheld" };
    const textPoll = targets.find(item => String(item.poll.id) === "11")!;
    const [options, detail] = await Promise.all([
      client.from("poll_options").select("id,poll_id,label,display_order").in("poll_id", targets.filter(item => item.poll.poll_type === "choice").map(item => item.poll.id)),
      client.rpc("get_poll_detail", { p_slug: textPoll.poll.slug, p_admin: false }),
    ]);
    if (options.error || !options.data || detail.error || !detail.data) throw new Error("SURVEY_DETAIL_UNAVAILABLE");
    // Recheck publication after reading text. Reopening/hiding a poll must not leak old results.
    const latest = publicSurveyTargets(await getPollCatalog(client));
    if (!latest) return { status: "withheld" };
    if (JSON.stringify(targets.map(item => item.poll)) !== JSON.stringify(latest.map(item => item.poll))) return { status: "unavailable" };
    return { status: "ready", data: buildSurveyOverview(latest, options.data, detail.data) };
  } catch {
    // No raw upstream errors, member text or identities in logs/RSC.
    return { status: "unavailable" };
  }
}
