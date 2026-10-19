import { Suspense } from "react";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getPoll } from "@/lib/supabase/queries";
import { PollForm } from "./PollForm";
import { getPollLoadErrorMessage, reportPollLoadError } from "@/lib/supabase/poll-errors";

async function PollContent({ pollId }: { pollId: string }) {
  const client = await getSupabaseServerClient();
  if (!client) return <p className="interaction-notice">투표를 준비하고 있습니다. 잠시 후 다시 확인해주세요.</p>;

  const result = await getPoll(client, pollId).then((data) => ({ data, error: "" })).catch((error) => {
    reportPollLoadError(pollId, "poll", error);
    return { data: null, error: getPollLoadErrorMessage(error) };
  });
  return <PollForm pollId={pollId} initialData={result.data} initialError={result.error} />;
}

export function Poll({ pollId }: { pollId: string }) {
  return (
    <Suspense fallback={<p className="interaction-notice" role="status">투표를 불러오는 중...</p>}>
      <PollContent pollId={pollId} />
    </Suspense>
  );
}
