import { handleApi, readJson, requireSameOrigin } from "@/lib/auth/http";
import { requireAdminApiSession } from "@/lib/auth/admin-session";
import { changeProjectEntry, getProjectAdmin } from "@/lib/project/data";

export async function GET() { return handleApi(getProjectAdmin); }
export async function POST(request: Request) {
  return handleApi(async () => {
    await requireAdminApiSession();
    requireSameOrigin(request);
    return changeProjectEntry(await readJson(request));
  });
}
