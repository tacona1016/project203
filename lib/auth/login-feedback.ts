import { AUTH_SERVICE_MESSAGE } from "./service-error.ts";

// WAF responses may be HTML rather than JSON. Never echo their body to a user.
// This is feedback only: enforcement belongs to a persistent server/platform rule.
export function loginFailureMessage(status: number, retryAfter: string | null,
  audience: "member" | "admin" = "member", now = Date.now()): string {
  if (status === 429) {
    let seconds = 0;
    if (retryAfter && retryAfter.length <= 128) {
      seconds = /^\d{1,6}$/.test(retryAfter) ? Number(retryAfter)
        : Math.ceil((Date.parse(retryAfter) - now) / 1000);
    }
    return Number.isFinite(seconds) && seconds > 0 && seconds <= 600
      ? `로그인 시도가 많습니다. ${seconds}초 후 다시 시도해주세요.`
      : "로그인 시도가 많습니다. 잠시 후 다시 시도해주세요.";
  }
  if (status === 401) return audience === "admin" ? "비밀번호가 올바르지 않습니다." : "이름과 비밀번호를 확인해주세요.";
  if (status === 503) return AUTH_SERVICE_MESSAGE;
  return "로그인하지 못했습니다. 잠시 후 다시 시도해주세요.";
}
