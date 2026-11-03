import { HttpError, requireSameOrigin } from "@/lib/auth/http";

export function noBoardQuery(request: Request) {
  if (new URL(request.url).search) throw new HttpError(400, "허용되지 않은 입력입니다.");
}
export async function readBoardBytes(request: Request, maximum: number) {
  if (Number(request.headers.get("content-length")) > maximum) throw new HttpError(413, "파일이 너무 큽니다.");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximum) { await reader.cancel(); throw new HttpError(413, "파일이 너무 큽니다."); }
      chunks.push(value);
    }
    return new Uint8Array(Buffer.concat(chunks));
  } finally { reader.releaseLock(); }
}
export async function emptyBoardMutation(request: Request) {
  requireSameOrigin(request); noBoardQuery(request);
  if ((await readBoardBytes(request, 1024)).length) throw new HttpError(400, "허용되지 않은 입력입니다.");
}
