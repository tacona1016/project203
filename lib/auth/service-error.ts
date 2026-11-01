export type AuthServiceFailure = "connection" | "timeout" | "database" | "internal" | "configuration";

export const AUTH_SERVICE_MESSAGE = "서비스 연결에 문제가 있습니다. 잠시 후 다시 시도해주세요.";
export const AUTH_RETRY_AFTER_SECONDS = 30;
export const authServiceHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Retry-After": String(AUTH_RETRY_AFTER_SECONDS),
  "Vary": "Cookie",
};

export class AuthServiceError extends Error {
  readonly reason: AuthServiceFailure;
  constructor(reason: AuthServiceFailure) {
    super(AUTH_SERVICE_MESSAGE);
    this.name = "AuthServiceError";
    this.reason = reason;
  }
}

function fields(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
}

// SDK fetch failures may be returned as PostgREST errors rather than thrown.
// Inspect only for classification; never serialize or log the original error.
export function toAuthServiceError(error: unknown, status?: number): AuthServiceError {
  if (error instanceof AuthServiceError) return error;
  const source = fields(error), cause = fields(source.cause);
  const codes = [source.code, cause.code].filter((value): value is string => typeof value === "string");
  const names = [source.name, cause.name].filter((value): value is string => typeof value === "string");
  const messages = [source.message, cause.message].filter((value): value is string => typeof value === "string").join(" ");
  const httpStatus = status ?? (typeof source.status === "number" ? source.status : undefined);
  if (codes.some(code => ["57014", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT"].includes(code))
    || names.some(name => ["AbortError", "TimeoutError"].includes(name))
    || [408, 504].includes(httpStatus ?? 0) || /timeout|timed out|AbortError/i.test(messages)) return new AuthServiceError("timeout");
  if (codes.some(code => /^(08|ECONN|ENET|EHOST|ENOTFOUND|EAI_|UND_ERR_SOCKET)/.test(code))
    || httpStatus === 0 || /fetch failed|failed to fetch|networkerror|network request|connection refused/i.test(messages)) return new AuthServiceError("connection");
  if (httpStatus === 401 || httpStatus === 403) return new AuthServiceError("configuration");
  if (codes.some(code => /^[A-Z0-9]{5}$|^PGRST\d+$/.test(code)) || (httpStatus !== undefined && httpStatus >= 400)) return new AuthServiceError("database");
  return new AuthServiceError("internal");
}

export async function runAuthLookup<T>(operation: () => PromiseLike<T> | T,
  report: (reason: AuthServiceFailure) => void = reason => console.warn(`[member-auth] service_${reason}`)): Promise<T> {
  try { return await operation(); }
  catch (error) {
    const failure = toAuthServiceError(error);
    report(failure.reason);
    throw failure;
  }
}

export function serviceUnavailableHtml() {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>잠시 후 다시 시도해주세요 | 203 PROJECT</title></head><body style="margin:0;background:#faf9f6;color:#20251f;font-family:system-ui,sans-serif"><main style="max-width:40rem;margin:14vh auto;padding:2rem;line-height:1.8"><p>203 PROJECT</p><h1>잠시 연결을 기다리고 있습니다.</h1><p>${AUTH_SERVICE_MESSAGE}</p><p>현재 페이지를 다시 불러오면 연결을 확인합니다.</p><a href="" style="color:inherit">다시 시도 →</a></main></body></html>`;
}
