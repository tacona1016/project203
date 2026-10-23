import { handleApi } from "@/lib/auth/http";
import { pollSlug, protectedClient } from "@/lib/site-data";
import { getPoll } from "@/lib/supabase/queries";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handleApi(async () => {
    const client = await protectedClient();
    const data = await getPoll(client, pollSlug((await params).slug));
    return { results: data.results, responses: data.responses };
  });
}
