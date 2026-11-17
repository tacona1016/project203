import { handleApi } from "@/lib/auth/http";
import { emptyBoardMutation } from "@/lib/board/feature-http";
import { cleanupPollImages } from "@/lib/poll-images/data";
export const maxDuration = 60;
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handleApi(async () => { await emptyBoardMutation(request); return cleanupPollImages((await params).slug); });
}
