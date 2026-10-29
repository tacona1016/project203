import { handleApi, requireApiSession } from "@/lib/auth/http";
export async function GET() {
  return handleApi(async () => ({ participant: (await requireApiSession()).participant }));
}
