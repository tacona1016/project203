import { Suspense } from "react";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getComments } from "@/lib/supabase/queries";
import { Comments } from "./Comments";

async function CommentContent({ quarter }: { quarter: string }) {
  const client = await getSupabaseServerClient();
  if (!client) return <p className="interaction-notice">의견 공간을 준비하고 있습니다. 잠시 후 다시 확인해주세요.</p>;
  const comments = await getComments(client, quarter).catch(() => null);
  return <Comments quarter={quarter} initialComments={comments} />;
}

export function CommentSection({ quarter }: { quarter: string }) {
  return (
    <Suspense fallback={<p className="interaction-notice" role="status">의견을 불러오는 중...</p>}>
      <CommentContent quarter={quarter} />
    </Suspense>
  );
}
