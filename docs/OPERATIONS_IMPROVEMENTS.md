# 안정성 및 운영 개선 기록

코드 검증일: 2026-11-01. 운영 DB 메타데이터의 읽기 전용 확인일: 2026-10-31.

## 적용 범위

- 회원 조회 실패를 유효하지 않은 로그인과 분리했다. 잘못된 정보·없는 회원은 기존 401, 연결/timeout/DB/내부 장애는 안전한 503과 재시도 안내를 사용한다.
- 장애 중 회원 자격이 확인되지 않으면 보호 콘텐츠를 제공하지 않는다. 기존 쿠키를 삭제하거나 로그인으로 반복 이동시키지 않고 복구 후 같은 세션으로 이용한다.
- 회원 목록·세션 조회에만 SDK 자동 재시도를 끄고 기존 10초 fetch timeout을 유지했다. SDK 기본 GET 재시도가 지연을 반복시키는 것을 방지한다. 다른 데이터 작업의 정책은 바꾸지 않았다. [Supabase retry 문서](https://supabase.com/docs/reference/javascript/retry)
- 분기 등록과 발표자료 공개를 `presentationPublished`로 분리했다. Poll/Admin은 모든 등록 분기, Home/Archive는 공개된 발표자료만 사용한다. 미공개 직접 URL은 404다.
- `npm run build`는 먼저 `check:presentations`를 실행한다. 공개 설정에 MDX가 없거나 MDX에 분기 metadata가 없으면 빌드를 중단한다. 공개 graphics는 기존 `public/` 자산이며 이 설정으로 비공개 사진이 되지 않는다.
- Home 현황은 `data/project-status.ts`의 `null`을 유지했다. 실제 단계·다음 행동·기준일은 미정이며 합의 전에는 임의로 표시하지 않는다.
- 결정 기록은 기존 BOARD 관리자 공지와 [복사 템플릿](DECISION_RECORD_TEMPLATE.md)을 사용한다. 실제 결정이나 새 DB 행을 등록하지 않았다.

회원 UUID·비밀번호·30일 회원 세션·8시간 관리자 인증·서버 작성자 식별을 유지했다. DB schema/RLS/grants, 투표/게시글/댓글 데이터, 발표 MDX와 기존 URL은 변경하지 않았다. 신규 dependency나 환경변수도 없다.

## 공개 상태 운영

1. `data/quarters.ts`에 새 분기를 `presentationPublished: false`로 등록한다. 발표 MDX가 없어도 해당 분기로 Poll을 운영할 수 있다.
2. 발표자료를 `app/quarter/<slug>/page.mdx`에 준비한다. MDX가 있어도 false이면 직접 접근할 수 없다.
3. 공개할 때 true로 바꾸고 `npm.cmd run check:presentations`, typecheck, build와 화면을 확인한다.
4. 최신 등록 분기와 최신 공개 발표자료는 다를 수 있다. 과거 분기 Poll도 기간과 수동 종료 설정에 따라 계속 활성이다.

## 확인한 보안·운영 범위

운영 읽기 전용 검사에서는 앱 테이블 7개의 RLS와 직접 접근 차단, 점검한 RPC 12개의 anon/authenticated 실행 차단 및 service_role 실행 허용을 확인했다. Storage의 bucket/object는 없었다. 실제 행 내용·비밀번호·쿠키·키를 보고서에 출력하지 않았다.

원격 migration 목록은 비어 있었지만 테이블은 존재했다. 수동 SQL 적용 여부를 대조해야 하며 과거 schema/seed/migration을 일괄 재실행하면 안 된다. 현재 변경을 위한 SQL은 없다.

로컬 설정은 JSON 객체이고 회원별 비밀번호 중복이 있는 상태였다. 운영 Vercel 설정의 중복 여부는 확인하지 않았다. 같은 비밀번호를 아는 사람은 해당 이름으로 로그인할 수 있다. UUID별 세션·서버 작성자 확인은 유지하며, 비밀번호를 임의로 교체하거나 중복을 거부하는 정책을 추가하지 않았다.

실제 요금 플랜·백업 보유·PITR·복구 성공은 확인하지 못했다. [백업/TEST 복구 절차](BACKUP_RESTORE.md)를 마련하고 dump 등 백업 파일의 Git 제외 규칙을 보강했다. 백업·복원·암호화 저장소 연결·자동화는 실행하지 않았다.

## 검증과 한계

| 실행 명령 | 결과 |
| --- | --- |
| `npm.cmd test` | 31개 통과, 실패 0 |
| `npm.cmd run lint` | 오류 0, 기존 `postcss.config.mjs` 익명 default export 경고 1 |
| `npm.cmd run typecheck` | 통과 |
| `npm.cmd run build` | 발표자료 파일 검증·MDX·TypeScript·production build 통과 |
| `npm.cmd run test:integration` | 합성 DB 장애/복구·공개 전환·기존 API 회귀 통과 |
| `npm.cmd run test:browser` | Chrome 모바일/데스크톱·세션·복구 검사 통과 |
| `npm.cmd run test:production` | 합성 환경 production build/start·Secure 쿠키·번들 canary 검사 통과 |

- 단위 테스트: Node runner 31개. 기존 21개와 인증 장애 5개·발표 공개 5개다.
- HTTP 통합: 실제 Next.js 서버와 합성 Supabase 프로토콜 fixture를 사용한다. 연결 단절·DB timeout·서버 오류·잘못된 응답·실제 10초 fetch timeout을 주입하고, 쿠키 유지와 복구·미공개 URL·기존 기능을 확인한다.
- 브라우저: Chrome의 모바일·자동완성/Enter·원래 경로 복귀·12장 발표·게시판·여러 탭 로그아웃·장애/복구를 검사한다.
- production fixture: build/start, Secure 쿠키와 브라우저 번들의 합성 secret canary 비노출을 검사한다.
- 실제 PostgreSQL transaction/RLS의 실행 회귀, Vercel CDN/쿠키, 백업 dump/TEST 복원은 별도 검증이 필요하다. 운영 DB에 테스트 행을 넣지 않았다.

Proxy가 장애를 확인한 페이지/API는 503이다. Proxy 통과 후 늦은 SSR 실패는 보호 본문을 제거하고 재시도 UI를 표시하지만 응답이 시작된 경우 HTTP 200일 수 있다. 로그는 원인 코드만 남긴다. Windows 격리 Chrome의 디스크 쿠키 복원 여부는 브라우저 보고서에 별도로 기록하며, 메모리에 합성 쿠키를 복원한 검사를 실제 디스크 유지 성공으로 간주하지 않는다.

로컬 결과는 Git 제외된 `.verification/`에 저장한다. 운영 배포·Git push·환경변수 변경·DB 쓰기는 수행하지 않았다. 운영 반영 전 Preview 기능 확인과 Dashboard 백업 설정 확인, 별도 승인된 TEST 복구 연습이 남아 있다.

## 변경 파일

| 목적 | 신규 파일 | 수정 파일 |
| --- | --- | --- |
| 인증 오류 분류·재시도 화면 | `lib/auth/service-error.ts`, `components/access/ServiceUnavailable.tsx` | `lib/auth/session.ts`, `lib/auth/members.ts`, `lib/auth/http.ts`, `proxy.ts`, `app/layout.tsx`, `app/access/page.tsx`, `components/access/MemberLoginForm.tsx`, `app/api/site-images/[key]/route.ts` |
| 발표 공개·Home 현황 | `data/project-status.ts`, `scripts/check-presentations.mjs` | `data/quarters.ts`, `app/page.tsx`, `app/archive/page.tsx`, `components/presentation/Presentation.tsx` |
| 회귀 검증 | `tests/auth-reliability.test.mjs`, `tests/presentation-publication.test.mjs` | `tests/poll-quarters.test.mjs`, `tests/fixtures/polls-server.mjs`, `tests/fixtures/board-server.mjs`, `tests/integration/member-auth.mjs`, `tests/integration/member-browser.mjs` |
| 운영 문서 | `docs/BACKUP_RESTORE.md`, `docs/DECISION_RECORD_TEMPLATE.md`, `docs/OPERATIONS_IMPROVEMENTS.md` | `AGENTS.md`, `README.md`, `docs/board.md`, `docs/member-auth.md` |
| 빌드·파일 보호 | — | `package.json`, `.gitignore` |

실제 비밀번호·키가 있는 환경 파일, dependency lockfile, SQL 및 발표 MDX·이미지 자산은 수정하지 않았다.
