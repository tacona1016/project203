import { handleApi, uuid } from "@/lib/auth/http";
import { protectedClient } from "@/lib/site-data";
import { getActiveParticipant, getParticipants } from "@/lib/supabase/queries";

export async function GET(request: Request) {
  return handleApi(async () => {
    const client = await protectedClient();
    const id = new URL(request.url).searchParams.get("id");
    return id === null ? getParticipants(client) : getActiveParticipant(client, uuid(id));
  });
}
