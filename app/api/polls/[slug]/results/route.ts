import { handleApi } from "@/lib/auth/http";
import { pollSlug, protectedClient } from "@/lib/site-data";
import { getPollId, getPollResults } from "@/lib/supabase/queries";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handleApi(async () => {
    const client = await protectedClient();
    const id = await getPollId(client, pollSlug((await params).slug));
    return getPollResults(client, id);
  });
}
