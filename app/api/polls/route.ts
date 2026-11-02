import { handleApi } from "@/lib/auth/http";
import { protectedClient } from "@/lib/site-data";
import { getMemberPollCatalog } from "@/lib/supabase/queries";

export async function GET() {
  return handleApi(async () => getMemberPollCatalog(await protectedClient()));
}
