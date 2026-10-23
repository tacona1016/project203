import { handleApi, readJson, requireSameOrigin } from "@/lib/auth/http";
import { adminClient, adminPollInput, checkAdminResult } from "@/lib/supabase/poll-admin";
import { getPollCatalog } from "@/lib/supabase/queries";

export async function GET() { return handleApi(async () => getPollCatalog(await adminClient(), true)); }
export async function POST(request: Request) {
  return handleApi(async () => {
    const client = await adminClient();
    requireSameOrigin(request);
    const data = adminPollInput(await readJson(request), true);
    return checkAdminResult(await client.rpc("admin_create_poll", { p_data: data }));
  });
}
