import "server-only";
import { NextResponse } from "next/server";
import { getAccessSession } from "./session";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function privateJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function requireApiSession() {
  if (!await getAccessSession()) throw new HttpError(401, "사이트 비밀번호 인증이 필요합니다.");
}

export function requireSameOrigin(request: Request) {
  // Next's internal request URL can use localhost behind the public Host header.
  const host = request.headers.get("host");
  const expected = host ? `${new URL(request.url).protocol}//${host}` : "";
  if (!expected || request.headers.get("origin") !== expected || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new HttpError(403, "요청을 처리할 수 없습니다.");
  }
}

export async function readJson(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new HttpError(400, "입력 내용을 확인해주세요.");
  // Bound the body while reading, including requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "입력 내용을 확인해주세요.");
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 16_384) { await reader.cancel(); throw new HttpError(413, "입력 내용이 너무 깁니다."); }
      chunks.push(value);
    }
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "입력 내용을 확인해주세요.");
  } finally { reader.releaseLock(); }
}

export async function handleApi(operation: () => Promise<unknown>) {
  try { return privateJson(await operation()); }
  catch (error) {
    // Do not serialize upstream errors: they may contain configuration or query details.
    return error instanceof HttpError ? privateJson({ error: error.message }, error.status)
      : privateJson({ error: "요청에 실패했습니다. 잠시 후 다시 시도해주세요." }, 503);
  }
}

export function uuid(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new HttpError(400, "이름을 다시 선택해주세요.");
  return value;
}

export function databaseId(value: unknown): string {
  const id = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof id !== "string" || !/^[1-9]\d{0,18}$/.test(id) || BigInt(id) > BigInt("9223372036854775807")) throw new HttpError(400, "투표 정보를 확인해주세요.");
  return id;
}
