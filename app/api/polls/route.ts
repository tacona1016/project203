import { handleApi } from "@/lib/auth/http";
import { protectedClient } from "@/lib/site-data";
import { getPollCatalog } from "@/lib/supabase/queries";

export async function GET() {
  return handleApi(async () => getPollCatalog(await protectedClient()));
}
