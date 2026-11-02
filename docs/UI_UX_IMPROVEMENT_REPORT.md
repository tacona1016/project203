# 203 PROJECT UI/UX·보안 통합 개선 보고서

기준: 2026-11-01. **로컬 개선 작업이며 push·배포·운영 DB/환경변수/공개 범위 변경은 하지 않았다.**

## 1. 개선 요약

| 구분 | 결과 |
| --- | --- |
| 구현 | 모바일 메뉴, HOME 현황·본인 미참여 요약, Poll 목록 본인 참여 상태·필터, 투표 피드백 대비, BOARD 글자 수, ADMIN 한국어·설정 요약, 비공개 사진 fallback, 결정 기록 양식 버튼 |
| 보안 코드 | 회원/관리자 로그인 HTML 429·Retry-After 안내와 중복 제출 방지, nosniff·프레임 차단 헤더, `.env.example` 실제 회원처럼 보이는 예시 제거 |
| 분석·운영안 | 공개 Git의 노출 범위, 로그인 제한, 백업/복구, FK 인덱스 권고 |
| 승인 대기 | 저장소 Private 전환, 실제 로그인 제한 설정, 운영 비밀번호 정책 변경, 백업 자동화, 코드 push/배포 |

현재 프로젝트 단계·목표·다음 행동·날짜는 합의된 값이 없어 **미정**으로 유지한다. `data/project-status.ts` 한 곳에서 확정된 내용만 입력한다. 새 DB·상태 관리·UI 라이브러리는 추가하지 않았다.

## 2. 시작 상태와 보존 범위

- remote main과 Production은 `584220bcd0ccc24233949660c4162ce65c366dfb`, Vercel READY였다. 로컬 Git HEAD는 메타데이터 쓰기 제한으로 `ddd552e`이며 이전 완료 코드가 working tree에 남아 있었다. 초기화·강제 동기화하지 않았다.
- 이번 변경은 `.verification/ui-ux-baseline.json`의 시작 시점 파일 해시와 비교한다. 이전 작업을 새 변경으로 집계하지 않는다.
- `poll_choice_selections`, `submit_choice_ballot`, 선택 집합 원자적 교체, 원본 votes 보존, 주관식 및 live/after_close 정책을 그대로 유지한다. 기존 migration/seed를 실행하지 않았다.
- Q4 MDX, 기존 투표·회원 UUID·댓글·게시글·공지·주요 URL과 회원 30일/관리자 8시간 세션을 보존한다.

## 3. 변경 파일과 이유

| 파일 | 변경 내용·이유 |
| --- | --- |
| `components/SiteHeader.tsx`, `SiteNav.tsx` | 헤더 범위의 client boundary와 disclosure 메뉴. ESC, 외부 클릭/포커스, 탐색 후 닫기. 본문을 client로 바꾸지 않음 |
| `app/globals.css` | 1024px 메뉴 분기, 44px 터치 영역, 참여 상태·저장 안내·관리자 요약·사진 fallback 스타일 |
| `app/page.tsx`, `data/project-status.ts` | 현황→투표→최신 발표 순서, nullable 진행 목표 추가, 확정 전 미정 표시 |
| `lib/supabase/types.ts`, `queries.ts` | 본인 참여 여부만 담는 optional 필드와 서버 세션 기반 일괄 조회. 실패 시 미참여로 단정하지 않음 |
| `app/api/polls/route.ts`, `app/polls/page.tsx`, `app/polls/[slug]/page.tsx` | 동일한 본인 상태 조회를 API·현재/과거 분기에 적용. 기존 상세 URL 유지 |
| `components/polls/PollCatalog.tsx`, `QuarterPolls.tsx`, `PollCard.tsx` | 현재 분기 진행/미참여 요약, 미참여 필터, 참여·변경 가능 표시와 기존 링크 유지 |
| `lib/board/validation.ts`, `components/board/BoardEditor.tsx`, `BoardComments.tsx` | 공통 길이 상수·codepoint 계산, 실시간 카운트·초과 안내·제출 차단 |
| `lib/board/decision-template.ts`, `docs/DECISION_RECORD_TEMPLATE.md` | 관리자 신규 공지의 결정 양식 입력. 기존 초안 교체 확인, 자동 저장/고정 없음 |
| `components/admin/PollEditor.tsx`, `AdminWorkspace.tsx`, `AdminPollList.tsx` | 한국어 안내, 기존 값으로 계산하는 저장 전 설정 요약 |
| `app/admin/page.tsx`, `app/admin/polls/page.tsx`, `new/page.tsx`, `[slug]/page.tsx`, `[slug]/edit/page.tsx` | 관리자 제목·이동·버튼 한국어 정리 |
| `components/access/MemberLoginForm.tsx`, `AccessForm.tsx`, `lib/auth/login-feedback.ts` | 정확한 비밀번호 FormData 유지, HTML 429/503 구분, 검증한 재시도 시간만 표시, 동기 제출 잠금 |
| `proxy.ts` | 기존 인증/장애/캐시 정책에 nosniff·X-Frame-Options DENY 추가 |
| `components/PrivateSiteImage.tsx`, 신규 `PrivateSitePhoto.tsx`, `lib/private-assets.ts` | 서버 인증을 유지하고 12바이트 MIME probe. 누락/로딩 실패에서도 일정한 영역 유지 |
| `.env.example` | 모든 실제 설정값을 공란으로 두고 합성 UUID 형식만 설명. 운영 설정은 변경하지 않음 |
| `tests/board.test.mjs`, `login-feedback.test.mjs`, `private-images.test.mjs` | 한글/이모지 경계, 안전한 429 안내, MIME·크기·경로 탈출 회귀 |
| `tests/fixtures/polls-server.mjs`, `tests/integration/poll-participation.mjs` | 본인 일괄 조회, 요청 수, 타회원 위조·조회 장애·비공개 결과 검증 |
| `tests/integration/member-auth.mjs`, `member-browser.mjs`, `ui-ux-browser.mjs` | 기존 HTTP/Chrome 회귀에 새 기능 연결, 여러 해상도와 메뉴/입력/요약 검증 |
| `docs/LOGIN_PROTECTION_PLAN.md`, `BACKUP_RESTORE.md`, `SESSION_HANDOFF.md`, 이 보고서 | 승인용 운영 절차, 실제 확인 범위와 인계 |

## 4. Before / After

| 영역 | 이전 | 개선 후 |
| --- | --- | --- |
| 모바일 탐색 | 다섯 메뉴·회원 정보 줄바꿈 | 로고·이름·메뉴 버튼, 메뉴 안 내비게이션과 로그아웃. 키보드/ESC 지원 |
| HOME | 소개·발표 중심, 참여 여부 없음 | 미정 현황 네 항목, 진행/내 미참여 수와 링크, 최신 발표 유지 |
| POLLS | 전체 상태·결과 중심 | 투표 상태와 별개로 본인 미참여/참여 완료/변경 가능/확인 불가. 완료한 투표도 다시 진입 가능 |
| BOARD | UTF-16 maxLength와 서버 기준 혼재 | 앞뒤 공백을 제외한 Unicode codepoint로 동일 계산, 입력 중 표시와 초과 차단 |
| ADMIN | 영어 혼재, 설정을 항목별 확인 | 한국어 섹션과 분기·유형·참여/수정·공개·기간·숨김 요약 |
| 사진 | 누락 시 영역 소멸, 로딩 오류 이미지 | 동일 높이 기본 배경. 보호 API·unoptimized 경로 유지 |

기본 이모지 1개는 1자이며 결합형 이모지·ZWJ는 여러 codepoint다. 줄바꿈도 센다. 입력 내용을 NFC 등으로 변환하거나 기존 DB 내용을 줄이지 않는다. HTML `maxLength`는 UTF-16 기준이므로 제거하고 공통 함수로 제한한다. 서버와 DB의 기존 10,000/2,000자 검사는 계속 적용된다.

## 5. 참여 조회·성능·결과 보안

- 회원 ID는 서버 세션에서만 결정한다. `participantId`/`authorId` 쿼리로 다른 회원 상태를 요청할 수 없다.
- metadata catalog 1회 뒤, choice는 canonical 테이블에서, text는 votes에서 **본인 poll_id만** 조회한다. Poll마다 RPC를 호출하지 않는다. 40개씩 묶어 PostgREST 응답 상한을 피하며 두 유형은 병렬 조회한다.
- 일반 목록의 숨긴 Poll은 조회 대상에서 제외한다. 미공개 결과·참여자 수·다른 회원의 선택·텍스트를 가져와 UI에서 감추는 구조를 만들지 않았다. 기존 catalog/RSC 결과 정책을 유지한다.
- 참여 조회 장애는 `ownParticipation=null`로 표시하고 전체 목록은 유지한다. HOME의 미참여 수는 ‘확인 불가’이며 0명으로 단정하지 않는다. 회원 인증 자체의 장애는 기존 503/fail-closed 경로를 따른다.
- 읽기 전용 운영 EXPLAIN 1회에서 예시 본인 choice 조회 실행 3.901ms, 계획 6.665ms였다. 한 번의 표본이며 전체 성능 보장은 아니다.
- Performance Advisor는 FK 인덱스 3개와 unused index 8개를 INFO로 보고했다. 현재 작은 데이터·조회 계획으로 즉시 병목이 입증되지 않아 인덱스를 추가/삭제하지 않았다. [FK 권고 설명](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [unused index 설명](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)

## 6. 보안 및 공개 저장소

### 확인한 사실

- GitHub API에서 현재 **Public**, 소유자는 개인 계정으로 확인했다. 원격 main의 recursive tree는 잘리지 않았고 MDX 1개·공개 그래픽 14개가 있었다. 실제 `.env.local` 등 환경 파일과 private-assets의 사진 파일은 추적되지 않았다.
- Public 저장소에서는 MDX 원문·사업 방향·예산 초안·공개 이미지·문서·추적한 예시 설정과 Git 이력을 사이트 로그인 없이 볼 수 있다. 앞으로 개인 사진을 이 저장소에 커밋하면 보호 Route Handler와 무관하게 GitHub에서 노출된다.
- 로컬 도달 가능한 12개 commit/307개 blob 버전과 최신 원격 추가 4개 commit diff의 알려진 Supabase Secret/PAT/개인키 패턴 검사에서 검출은 없었다. 로컬 이력의 `.env.example`/문서에는 비어 있지 않은 예시 리터럴·UUID가 있었고 운영 값인지 검증하지 않았다. 현재 예시 파일은 공란/합성 UUID로 정리했다. 기존 공개 이력과 복제본은 그대로다.
- 이 검사는 알려진 패턴과 도달 가능한 이력에 한정한다. 임의의 짧은 실제 비밀번호, 모든 원격 branch·삭제 이력·외부 복제본의 비밀 부재를 증명하지 않는다. 실제 환경변수 원문이나 회원 비밀번호는 읽지 않았다.
- 회원/관리자 세션 목적·서명·기한·비밀번호 회전·active 확인·세션 기반 작성자·same-origin 검증을 유지한다. 브라우저 Supabase 직접 접근은 열지 않았다.
- 운영 8개 테이블 RLS 활성화, anon SELECT/INSERT 및 authenticated SELECT 차단, security advisor 지적 0개를 확인했다. 실제 약한/중복 비밀번호 사용 여부는 미확인이다. 코드상 비어 있지 않은 문자열만 요구한다.

### 승인 후 권장 작업

1. 저장소 Settings → General → Danger Zone → Change repository visibility → Private. 먼저 Vercel GitHub App의 이 저장소 접근 권한과 배포 작성자 권한을 확인한다. 변경은 자동 수행하지 않았다.
2. Vercel은 개인 계정 Private 저장소 연동을 지원한다. Hobby에서 조직 소유 Private 저장소는 별도 제한이 있으므로 현재 개인 소유 저장소를 조직으로 옮기는 작업과 혼동하지 않는다. 전환 후 승인된 Preview로 접근·빌드를 확인한다. [Vercel Git 조건](https://vercel.com/docs/git), [GitHub 전환 절차/공개 fork 한계](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility)
3. Private 전환만으로 기존 fork·clone·외부 캐시는 회수되지 않는다. 공개 예시 비밀번호를 실제로 재사용했다면 운영자가 별도로 변경 여부를 검토한다. 강제 초기화·키 회전·force push는 수행하지 않는다.
4. 개인별 서로 다른 충분히 긴 비밀번호 사용을 권장한다. 현재 값은 그대로 허용하며 임의의 새 강도 규칙을 추가하지 않았다. 같은 비밀번호를 아는 사람은 해당 이름으로 로그인할 수 있다는 한계는 남는다.
5. 로그인 제한은 [운영 적용안](LOGIN_PROTECTION_PLAN.md)을 검토한다. 현재 코드에 지속성 있는 limiter는 없으며 Vercel 설정 조회는404로 실제 적용 여부 미확인이다. 메모리 limiter나 새 DB/외부 서비스는 추가하지 않았다. 운영 룰은 승인 후 관찰·Preview·오탐 검토를 거쳐 적용한다.

## 7. 백업·DB·배포

- 신규 schema·migration·RLS/grants 변경 없음. 운영 SELECT/EXPLAIN만 실행했다. 회원·투표·게시글·댓글을 만들거나 수정하지 않았다.
- 운영 raw votes 45행과 canonical 37행, Storage bucket/object 0개를 읽기 확인했다. 원본과 canonical 둘 다 백업 대상이다. 실제 백업 보유·플랜·PITR·복구 성공은 확인하지 못했다.
- [백업/복구 문서](BACKUP_RESTORE.md)에 실제 적용된 canonical migration 이력과 8개 테이블을 반영했다. 수동 암호화 백업과 별도 TEST DB 복구 연습을 권장하며 스케줄·외부 저장소는 연결하지 않았다.
- 환경변수 추가/이름 변경 없음. `.env.example`만 정리했으며 실제 `.env.local`·Vercel 설정은 변경하지 않았다.
- 적용은 로컬 검증 결과 검토 → 별도 승인 → GitHub 반영/Preview → 승인된 Production 배포 순서다. 이번 코드는 현재 운영 DB와 호환되며 SQL 실행이 필요 없다. `supabase db push`·과거 seed/migration을 실행하지 않는다.
- 롤백은 직전 `584220b` 앱으로 돌아가면 된다. 이번 작업에 DB 변경이 없으므로 DB 복원은 필요 없다. 그보다 옛 복수선택 개편 이전 앱으로 돌아가면 canonical 참여 조회가 어긋날 수 있다.

## 8. 테스트와 미검증 범위

| 명령·검사 | 최종 결과 |
| --- | --- |
| `npm.cmd test` | **47개 통과**, 실패/skip 0. 기존 38개와 Unicode·429·보호 이미지 회귀 9개 |
| `npm.cmd run test:integration` | 실제 Next.js HTTP 경계 + 합성 Supabase/BOARD fixture 통과. 서버 세션 기반 batch 참여 조회·위조 ID·장애 복구 검사 포함 |
| `npm.cmd run test:browser` | Chrome **320/390/430/768/1440px** 통과. 모바일 메뉴·키보드/ESC/외부 클릭·로그아웃·429·Admin 요약·BOARD Unicode·템플릿·사진 누락/네트워크 실패·분기 필터·기존 투표 회귀 |
| `npm.cmd run test:production` | 합성 환경 production build/start·Secure 쿠키·서버 비밀값 canary·API 회귀 통과 |
| `npm.cmd run typecheck` | 통과 |
| `npm.cmd run lint` | 오류 0, 기존 `postcss.config.mjs` 익명 default export 경고 1 |
| `npm.cmd run build` | MDX publication 검사·TypeScript·production build 통과. 기존 페이지/API 생성 정상 |
| 보존·문서 검사 | Q4 MDX/분기 metadata/인증 핵심/투표 submit/migration/dependency 등 10개 hash 불변, `git diff --check`와 문서 링크 검사 통과 |

390/768/1440px HOME·POLLS·BOARD·ADMIN 작성 화면과 공지 양식 스크린샷은 Git에서 제외된 `.verification/member-browser/ui-*.png`에 있다. 예: `ui-home-390.png`, `ui-polls-768.png`, `ui-admin-new-1440.png`, `ui-notice-template-390.png`. 운영 회원·사진이 아닌 합성 데이터다.

초기 Chrome 검사 두 번에서 탐색 중 잠시 없는 헤더 조회와 CSS 반영 전 즉시 측정하는 하네스 오류가 있었다. 실제 컴포넌트·CSS 표시를 기다리도록 수정한 뒤 최종 전체 검사가 통과했다. 중간 실패와 최종 결과를 구분한다. 최종 로컬 로그에서 hydration mismatch는 발견되지 않았다.

운영 로그인·실제 투표/게시글 테스트는 수행하지 않았다. 실제 PostgreSQL 쓰기·동시성은 이번 UI 변경의 합성 검증과 별도다. Windows 격리 Chrome의 디스크 쿠키 복원이 지원되지 않아 저장한 합성 쿠키를 메모리 복원해 재실행 유효성을 확인했다. OS 차원의 지속 저장을 실기기에서 검증한 것은 아니다.

Chrome 테스트는 320/390/430/768/1440px를 대상으로 한다. 실제 iPhone Safari/WebKit·기기별 글꼴·운영 배포 E2E는 별도 확인이 필요하다. 합성 HTTP의 동시 요청 검증은 실제 PostgreSQL 두 연결 동시성 검사와 다르다. 운영 세션/키가 포함된 로그·이미지·DB 백업은 보고서나 Git에 넣지 않는다.
