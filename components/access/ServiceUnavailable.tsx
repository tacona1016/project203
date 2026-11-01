import { AUTH_SERVICE_MESSAGE } from "@/lib/auth/service-error";

export function ServiceUnavailable() {
  return <main id="main-content" className="access-page">
    <div className="access-content">
      <p className="wordmark">203 PROJECT</p>
      <p className="eyebrow mt-16 text-accent">PLEASE TRY AGAIN</p>
      <h1 className="mt-5 text-3xl font-medium tracking-tight sm:text-4xl">잠시 연결을 기다리고 있습니다.</h1>
      <p className="mt-5 text-muted" role="alert">{AUTH_SERVICE_MESSAGE}</p>
      <p className="mt-4 text-sm text-muted">현재 페이지를 다시 불러오면 연결을 확인합니다.</p>
      <a href="" className="interaction-button mt-8">다시 시도</a>
    </div>
  </main>;
}
