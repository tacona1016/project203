# 203 PROJECT 운영 안정화 및 UI/UX 통합

2026-11-08. 로컬 구현과 검증, 외부 읽기 확인을 구분한다. 운영 데이터·Storage·RLS·회원 비밀번호·환경변수를 변경하지 않는다. main push와 Production 배포는 승인 대기다.

## A. 시작 상태와 기존 작업 보존

| 항목 | 확인 결과 |
| --- | --- |
| GitHub main | `71457ceb1ed82f6440bc0649129cf6bd3621be13` — 연결 도구로 이번 작업에서 재조회 |
| Production | `dpl_AnfDMN7vwsMv33ccErSakvSqk7o1`, 같은 SHA, READY, `project203.vercel.app` 연결 |
| 기존 Preview | `dpl_8NzRWN5hxV3frmEve8YrgasXPzp8`, `4811b7e`, READY. 이번 개선 Preview가 아님 |
| 루트 | `fix/rebase-integrity` / `e46d233`, 기존 복구와 후속 작업이 미커밋 상태로 남음 |
| 안전한 통합 브랜치 | `.verification/board-feature-branch` 저장소의 `fix/stabilization-ux-integrated-20261108` — 최신 원격71457ceb를 직접 부모로 하는 통합 커밋 |
| Git 제한 | 루트 fetch는 `.git/FETCH_HEAD` 쓰기 제한, 검토 저장소 fetch는 로컬 외부 네트워크 연결 실패. 강제 초기화·이력 변경 없이 GitHub 연결 도구로 원격 확인 |
| 원격 파일 대조 | 원격 tree 262파일 중 로컬 누락 0개. SQL 차이는 CRLF/LF 차이. 기존 구현/문서 차이를 보존 |

Compact UI 최종 27파일은 인계 문서 외에 해시가 같았고, 사진 압축 최종 명세도 모두 같았다. 두 작업을 다시 만들지 않았다. 요청에 적힌 `.verification/compact-measurements.json`은 없으며 실제 자료는 `.verification/member-browser/compact-measurements.json`이다. 다른 지정된 보고서·명세·사진 샘플 자료는 존재한다.

이번 시작 파일 268개의 SHA256은 `.verification/stabilization-baseline.json`, 이전 화면 관련 파일은 `stabilization-before/`, 최종 후보 명세는 `stabilization-candidate.json`에 보관한다. `.verification/`는 Git 제외이므로 다른 PC에 자동 전달되지 않는다.

## B. 실제 개선

| 영역 | 변경 및 상태 |
| --- | --- |
| HOME 순서 | 소개 → 최신 발표자료 → 투표 → 통합 현황 → 등록된 결정/공지 → 로드맵 → 실제 일정/후보지. JSX 순서이며 발표와 투표 인접 유지 |
| 프로젝트 현황 | 실제 설정된 단계·논의 목표·다음 행동·기준일·검증된 내부 링크 지원. `projectStatus=null`은 기존 한 줄 안내를 유지. 새 상태나 날짜를 임의 확정하지 않음 |
| 빈 영역 | 일정이 없으면 섹션 생략. 공지/결정이 없으면 해당 영역 생략. 투표 0개는 짧은 안내와 이동 링크. 실제 조회 실패는 빈 데이터로 바꾸지 않고 재시도 안내 |
| 최근 결정 | 기존 `contentLinks.decisionPostIds`에 명시적으로 등록한 미삭제 관리자 공지만 최신 등록순 최대 3건. 제목 문자열이나 투표 종료 상태로 결정 여부를 추정하지 않음 |
| 결정 연결 | 같은 명시적 그룹의 실제 비숨김 투표 제목/링크만 일괄 조회. 결정 원문·타인 응답·비공개 결과 집계는 HOME으로 가져오지 않음. 같은 결정 공지를 최신 공지에 중복 표시하지 않음 |
| POLLS | 기존 Compact 카드·내 참여 상태·미참여 우선 최대 3건·마감 정보·기존 필터 유지. 저장 RPC와 결과 공개 정책 변경 없음 |
| BOARD | 기존 Compact 목록·배너·검색·쓰기·수정·댓글·좋아요·사진 유지. 확대 dialog의 미정의 색상 변수를 paper/ink로 교체 |
| ARCHIVE / ADMIN | 기존 접이식 검색·공개 발표자료·상단 주요 행동·통계/폼 밀도 유지. 발표 콘텐츠/모드/인증 변경 없음 |
| CSS | 무조건 적용되는 동일 선택자 9개를 통합, 동일한 통계 breakpoint 중복 제거. HOME 간격을 `--site-section-gap`으로 통일. 발표 슬라이드 스타일은 보존 |
| 배포 보호 | 기존 충돌/발표 검사 유지. 기존 CI가 없음을 확인하고 PR 전용 `.github/workflows/validate.yml` 추가. 테스트·타입·lint·빌드만 실행하며 배포·운영 DB·secret 사용 없음 |

결정 기록은 BOARD 공지를 작성한 뒤 코드에서 실제 ID와 관련 투표만 등록한다. 현재 실제 결정 관계는 확정되지 않아 `contentLinks=[]`를 유지하며 운영 화면에는 가짜 결정 영역을 표시하지 않는다. 공지 등록일은 결정일이 아니며 결정일은 원문에 작성한다. 대체된 기록은 DB에서 삭제하지 않고 목록에서 제외한 후 후속 공지를 연결한다. 상세 절차는 `DECISION_RECORD_TEMPLATE.md`를 따른다. DB 메타데이터 migration은 필요 없다.

## C. 보존 범위

- 회원 UUID/30일 회원 세션/8시간 관리자 추가 인증, 서버 작성자 판별, Supabase 서버 전용 접근과 RLS 보존.
- `poll_choice_selections` / `submit_choice_ballot`, 단일·복수·주관식·선택 변경·결과 공개/재개 정책 보존.
- 게시글·댓글·공지·수정·삭제·좋아요, 기존 사진 URL/재시도/해시 검증 보존.
- 신규 저장 WebP **500,000bytes 이하**, 원본 **3MiB 이하**, 글당 **3장**, Private Storage 유지. 기존 500KB 초과 사진 열람도 유지. 일괄 재압축/삭제 없음.
- MDX 원문·발표자료 공개 설정·목차/스크롤/발표 모드·분기 구조 보존.
- 새 패키지, SQL, RLS/버킷 변경, 운영 테스트 데이터 없음. 과거 migration/schema/seed 재실행 없음.

## D. 검증

| 검증 | 현재 결과 |
| --- | --- |
| `npm test` | 82/82 통과. 기존 80개 + 결정 명시성/정렬 2개 |
| `npm run typecheck` | 통과 |
| `npm run lint` | 오류 0, 기존 postcss 익명 default export 경고 1 |
| `npm run check:conflicts` | build 전 검사 통과 |
| `npm run check:presentations` | build 전 검사 통과 |
| `npm run build` | 최종 앱 코드 Next16.4.2 production compile/type/routes/MDX 통과 |
| `npm run test:browser` | 최종 Chrome 43항목 + 합성 HTTP 21항목 통과. 390/768/1440px의 Home/Polls/Board/Archive/Admin 15개 캡처, 기존 320/430px 검사 포함 |
| `npm run test:production` | 로컬 Next production build/start + 합성 HTTP 19항목 통과. 실제 Vercel 회원 E2E와 구분 |
| Preview HTTP | 신규 Preview READY. 비로그인 polls/보호 사진401. `/access`와 로그인으로 이동한 Archive503 연결 안내. 필수 변수5개가 Preview에 없어 로그인 이후 미검증 |
| 운영 읽기 | 로그인 화면 HTTP200, 비로그인 polls API/사진401, Archive 요청은 로그인 화면으로 이동. 회원 로그인 후 E2E 아님 |
| 실제 운영 쓰기 E2E | 미검증. 운영 회원/글/투표/사진을 테스트용으로 만들지 않음 |

Node의 기존 MODULE_TYPELESS_PACKAGE_JSON 경고는 테스트를 실패시키지 않으며 이번 변경에서 모듈 구조를 전환하지 않았다. 최초 HTTP 순서 테스트는 Suspense 전송 바이트 순서와 DOM 순서를 혼동했다. 실제 순서는 Chrome의 settled DOM에서 검사하며 HTTP는 접근 제어/응답 내용/노출을 검증하도록 바로잡았다. 빈 상태 검증도 hidden script의 fallback 문자열 대신 화면에 표시된 상태 요소를 기다린다.

브라우저는 실제 Chrome을 사용하지만 DB/Storage는 로컬 합성 HTTP fixture다. 실제 Postgres transaction/동시성·Storage 업로드 성공과 동일하게 보고하지 않는다. Safari/iPhone 실기기·OS 쿠키 영속성·실제 회원 Preview E2E는 별도 미검증이다.

최종 브라우저의 uncaught JavaScript 예외0/hydration 오류0을 기록했다. 의도적으로 발생시킨 API503·네트워크 실패는 오류 복구 시나리오이며 콘솔 무오류 범위와 구분한다. 합성 현황/목표/링크/미래 일정은 격리된 fixture 페이지에만 존재하고 실제 앱·DB에는 추가하지 않는다.

이미지 실측/검증과 기존 동작을 모두 포함한다. 신규 압축 결과의 byte_size/SHA256/반복 요청 일치, 기존500KB 초과 이미지 원문 유지·열람, 사진 선택/개별 재시도/확대, 좋아요/댓글 수정, 복수선택/선택 변경/비공개 결과·관리자 권한·세션 회귀가 통과했다. `test:integration`의 내용을 browser/production 실행이 포함하므로 동일 명령을 별도로 중복 실행하지 않았다.

증거: `.verification/member-browser/report.json`, `stabilization-console.json`, `compact-measurements.json`, `compact-*.png`; `.verification/stabilization-browser-http-report.json`, `member-auth-report.json`, `stabilization-preservation.json`. 보호 파일104개 해시 동일, 발표 관련 CSS 규칙 동일, 시작 파일 삭제0개다.

## E. 배포 준비 및 제한

앱 코드 통합은 로컬 안전 브랜치에서 준비한다. 루트의 오래된 HEAD/main을 push하지 않는다. GitHub 원격 변경을 보존하며 승인 후 최신 원격 위에서 후보 파일의 diff를 검토한 뒤 fast-forward 가능한 변경으로 반영해야 한다. 강제 push/reset/clean은 사용하지 않는다.

새 DB/Storage 설정/환경변수는 필요 없다. 최근 결정을 BOARD에서 자동 판별하는 DB 기능을 추가하지 않았으며 직접 등록하는 코드 설정을 사용한다. Preview에 기존 서버 환경변수가 없다면 서비스 연결 안내/접근 차단만 검증할 수 있고 로그인 이후 동작은 검증 완료로 표시하지 않는다.

Production 적용은 사용자 승인 후 최신 원격 확인 → 검증된 통합 후보 검토 → 필요한 Preview 인증 검증 → main 반영 → 신규 SHA의 READY/도메인 확인 순서다. 운영 데이터나 버킷을 롤백하지 않고, 앱 오류 시 기존 `71457ceb` Production으로 되돌릴 수 있다. 승인 전 Production 승격/환경변수 복사/운영 DB 쓰기는 하지 않는다.

GitHub 저장소는 현재 Public이다. 원본 MDX와 공개 이미지 등 커밋된 프로젝트 콘텐츠는 사이트 로그인과 별개로 조회될 수 있다. 비공개 전환은 권장되지만 이번 작업에서는 설정을 변경하지 않았다. 보호된 개인 사진은 Private Storage/기존 private-assets 보호 방식을 유지하며 Git에 추가하지 않는다.

## F. Preview와 적용 판단

- Preview URL: https://project203-2pf0w3psh-project203.vercel.app
- Deployment: `dpl_DuRLCrrEWi9BuJnrNWk5Jruq2qYx`, **READY**, target=null(Preview). Production 승격/도메인 변경 없음.
- Git 연동 배포가 아니라 로컬 파일 API 배포다. 배포된 Git SHA가 있다고 주장하지 않는다. 앱189파일745,462bytes의 SHA256 명세 digest `cd68a6feba4777369796e602c70353bd6138f2d233c2163e881393ad10a54a69`로 후보를 식별한다. 배포 후 현재 앱과189파일 모두 동일함을 확인했다.
- `.env*`, 비밀값, 개인 사진, 테스트 fixture는 Preview 파일에서 제외했다. 기존 프로젝트 설정/환경변수는 바꾸지 않았다.
- 값 복호화 없이 환경변수 이름/target만 확인했다. `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SITE_SESSION_SECRET`, `BOARD_PARTICIPANT_PASSWORDS`, `ADMIN_PASSWORD`는 전부 Production에만 있고 Preview에는 없다. 로그인 화면503은 인증 디렉터리 설정 누락으로 확인됐다. 인증 우회나 운영 환경변수 복사로 해결하지 않았다.
- Preview에서 Linux npm 설치·Next16.4.2 compile/타입/빌드가 성공했다. 기존 engines>=22 자동 상위 버전 선택, npm cache-dir/install-scripts, ESM 경고가 있지만 빌드 오류는 없다. 원인과 무관한 버전/환경 설정은 바꾸지 않았다.
- Production 별칭을 배포 후 다시 조회하여 기존 `71457ceb`/`dpl_AnfDMN7vwsMv33ccErSakvSqk7o1` READY에 그대로 연결된 것을 확인했다.

| 항목 | 상태 |
| --- | --- |
| Compact UI/압축 통합, HOME/CSS 개선 | 완료 및 검증 |
| 최근 결정 표시 구조 | 구현 완료·실서비스 미검증. 실제 합의된 연결 등록 없음 |
| Preview build·비로그인 차단 | 완료 및 검증 |
| Preview 실제 회원 로그인/Storage | 미완료. 별도 테스트 환경/설정 승인 필요 |
| PR 검증 workflow | 구현 완료·GitHub 실행 미검증. 이번 작업에서 push/PR 활성화 안 함 |
| main 반영/Production 배포 | 승인 대기 |

Production에 필요한 신규 환경변수나 SQL은 없다. 실제 회원 E2E까지 확인하려면 별도 테스트 DB/회원이 있는 Preview 설정을 승인 후 준비해야 한다. 기존 Production 비밀값을 Preview로 복사하지 않는다. 코드 검증·빌드 준비는 완료했으며, 전체 실서비스 검증 완료를 뜻하지 않는다.

## G. 이번 시작 대비 변경 파일

| 파일 | 목적 |
| --- | --- |
| `app/page.tsx` | 공지/결정 서버 영역 통합, 빈 wrapper 제거, 발표→투표 순서 유지 |
| `app/globals.css` | 동일 선택자9개 정리, HOME 간격 토큰, 유동 현황 열, dialog 색상 수정 |
| `components/home/ProjectTasks.tsx` | 실제 목표/날짜/내부 링크, null 안내 보존 |
| `components/home/UpcomingEvents.tsx` | 데이터가 없으면 생략, 격리된 데이터 검증 지원 |
| `components/home/LatestNotices.tsx` | 결정/공지 분리, 중복/빈 영역 제거, 장애 안내 |
| `components/polls/PollCatalog.tsx` | 투표0개 짧은 안내와 조회 실패 구분 |
| `data/project-status.ts` | 선택적 내부 관련 링크 타입, 실제 값null 보존 |
| `data/content-links.ts` | 확정 공지 ID 목록 운영 원칙 명시 |
| `lib/board/notices.ts` | 명시적 공지/실제 관련 투표만 서버 일괄 조회 |
| `lib/home-decisions.ts` (신규) | ID 기반 최신3건 정렬/큰 bigint 보존 |
| `tests/home-decisions.test.mjs` (신규) | 제목 추정 금지·정렬·최대수·불변성 |
| `tests/fixtures/board-server.mjs` | 격리된 공지/조회 실패·빈 결과 fixture |
| `tests/integration/home-stabilization.mjs` (신규) | 빈 결과/실패/삭제·일반글 제외/숨김 투표·본문 미노출 |
| `tests/integration/member-auth.mjs` | 새 검증 연결·격리된 현황 테스트 페이지 |
| `tests/integration/member-browser.mjs` | uncaught/hydration 오류 계수 |
| `tests/integration/compact-browser.mjs` | settled DOM·빈 영역·실제값/일정 반응형 |
| `.github/workflows/validate.yml` (신규) | PR 전용 테스트/타입/lint/build |
| `docs/DECISION_RECORD_TEMPLATE.md` | HOME 결정 등록·변경·기록 보존 방법 |
| `docs/SESSION_HANDOFF.md` | 재개 가능한 진행/검증/제한 기록 |
| `docs/PROJECT203_STABILIZATION_AND_UX.md` (신규) | 이 보고서 |

위20파일이 이번 작업 범위다. 기존 Git diff에 포함된 복구/BOARD/압축/Compact 작업을 이번 신규 작업으로 다시 계산하지 않는다. 기존 과거 보고서와 인계 내용은 보존한다. QA 산출물은 Git 제외이며 정확한 추가/수정 해시는 `.verification/stabilization-changed-files.json`에 기록한다.

## H. 최종 Git 보존 결과

- 통합 코드 commit: `ee2e978c33e6ed2d98bc77004345b92cc0592005`, parent `71457ceb1ed82f6440bc0649129cf6bd3621be13`. 기존 remote3커밋의 author/tree/parent/message 원문을 정확한 SHA로 확인하고 필요한 객체를 별도 검토 저장소에 가져왔다. connectivity fsck가 통과했으며 원격 refs나 루트 refs를 수정하지 않았다.
- 원격 main 대비50파일 변경이다. 이번20파일 외에 이전 Compact UI와500KB 압축·보고서의 미반영 차이도 함께 포함한다. 기존 SQL/인증/API/패키지 잠금 파일은 원격 대비 변경하지 않았다. root의 기존 미커밋 복구 내용은 그대로 보존한다.
- 루트는 여전히 fix/rebase-integrity/e46d233의 기존 dirty 상태다. 통합 브랜치가 있는 별도 저장소에서 후속 Git 작업을 수행한다. 기존 feat/board-likes-images 및 이번 초기 checkpoint 브랜치도 보존했다.
- GitHub push/PR 생성, main 병합, Production 배포는 수행하지 않았다. 원격 main이71457ceb 그대로인 경우 이 통합 커밋은 fast-forward 대상이지만 반드시 승인과 원격 최신 재확인 후 진행한다. 강제 push가 필요하지 않다.
- 이 절과 최종 인계 영수증은 코드 변경 없는 문서 후속 커밋으로 기록한다. Preview는 위 앱 명세로 식별하며 Git 커밋 기반 배포라고 표시하지 않는다.
