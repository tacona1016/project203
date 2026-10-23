import { handleApi, HttpError, readJson, requireSameOrigin } from "@/lib/auth/http";
import { protectedClient } from "@/lib/site-data";
import { boardInput, boardPage, boardSearch } from "@/lib/board/validation";
import { getBoardPage, writeBoardPost } from "@/lib/board/data";

function parse<T>(operation: () => T) { try { return operation(); } catch (error) { throw new HttpError(400, (error as Error).message); } }
export async function GET(request: Request) {
  return handleApi(async () => { await protectedClient(); const params = new URL(request.url).searchParams;
    return getBoardPage(parse(() => boardSearch(params.get("q"))), parse(() => boardPage(params.get("page")))); });
}
export async function POST(request: Request) {
  return handleApi(async () => { await protectedClient(); requireSameOrigin(request);
    const body = await readJson(request, 65_536); return writeBoardPost(null, parse(() => boardInput(body))); });
}
