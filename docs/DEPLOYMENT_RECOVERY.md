# Rebase 충돌 및 Vercel 빌드 복구

2026-11-02. 이 문서는 코드 복구와 로컬 검증 기록이다. 실제 릴리스 커밋·배포 ID·READY 확인은 작업 종료 응답과 Git 제외 `.verification/rebase-recovery-release.json`에 별도로 남긴다.

## 원인과 이력 보존

- 실패 배포: `dpl_JD78sjEznmbEfp2ETzz8B4vcCegK`, Production, 커밋 `e46d233ab28b283e1e0274f5b54eded62002b9ab`.
- 실제 Vercel 로그: `Turbopack build failed with 36 errors`, `Merge conflict marker encountered`, 소스의 독립된 충돌 제어 줄.
- 정상 서비스는 점검 당시 `584220bcd0ccc24233949660c4162ce65c366dfb`의 READY 배포를 유지하고 있었다. 기존 배포는 삭제하거나 다시 빌드하지 않는다.
- rebase는 이미 종료됐다. 원격 584220b는 실패 커밋의 부모이며 원래 로컬 e9843ed는 백업 브랜치/ORIG_HEAD에 보존돼 있다. clean tree는 충돌이 정상 해결됐다는 뜻이 아니었다.
- 18파일31구간, 마커93줄과 마커 밖 중복을 발견했다. e9843ed 대비 실패 커밋은 19파일201줄 추가뿐이며 파일/코드 삭제는 없었다. 원본과 원격 변경을 비교해 최신 UI를 한 구현으로 통합했다.

## 복구한 파일과 의도

| 파일 | 통합 내용 |
| --- | --- |
| `app/page.tsx`, `app/archive/page.tsx` | HOME 대시보드·공지/목표와 공개 발표 검색/목록 유지 |
| `components/access/MemberLoginForm.tsx` | 기존 회원 인증과 새 오류 안내 유지 |
| `components/admin/PollEditor.tsx` | hydration 보호·중복 제출 방지·필드 오류/한글 UI 유지, subscribe 중복 제거 |
| `components/interactive/PollForm.tsx` | canonical 복수선택·불확실 응답 복구·주관식 참여율·선택 요약 유지, Feedback/normalize/sameSelection 중복 제거 |
| `components/interactive/PollResults.tsx`, `components/polls/PollCard.tsx` | 결과 정렬·동률·분모와 본인 참여 상태 유지 |
| `components/presentation/Presentation.tsx`, `data/project-status.ts` | 발표 목차/연결과 미정 프로젝트 상태 유지 |
| `lib/supabase/queries.ts`, `lib/supabase/types.ts` | 회원별 일괄 참여 조회·공개 결과 분모·최신 타입 유지 |
| `tests/fixtures/polls-server.mjs`, `tests/integration/{member-auth,member-browser}.mjs` | 기존 API/투표 검사와 새 UI/공지/댓글 회귀를 함께 유지 |
| `README.md`, `docs/{BACKUP_RESTORE,DECISION_RECORD_TEMPLATE,SESSION_HANDOFF,board}.md` | 새 운영 안내와 과거 기록 참조 보존, 중복 절 정리 |

인증 모듈·기존 SQL migration·canonical 제출 API·Q4 MDX·quarter metadata·lockfile 등 핵심27파일은 원본 e9843ed와 동일함을 검사했다. 앱 복구 파일도 원본 최신 구현과 대조했다. DB/RLS·비밀번호·환경변수 변경이나 migration 실행은 없다.

## 충돌 재발 방지

- `scripts/check-conflicts.mjs`, `npm run check:conflicts` 추가.
- 실제 독립된 시작/구분/종료/diff3 제어 줄을 파일/행 번호로 보고하고 exit 1로 실패한다. 불완전한 마커도 차단한다.
- 따옴표 안 문자열·일반 테스트 예시·inline 설명은 실제 마커로 처리하지 않는다. 제어 줄 모양을 그대로 독립 행으로 넣는 예시는 피한다.
- 소스·MDX·문서·SQL을 재귀 검사하고 생성물·의존성·비공개 자산·비밀 파일·symlink는 제외한다. Git 디렉터리가 없는 배포 소스에서도 작동한다.
- build는 conflict check → presentation check → Next build 순서다. 검사 비활성화·기능 삭제·라이브러리 추가는 없다.
- `tests/conflict-check.test.mjs`의4개 회귀는 CRLF/들여쓰기/diff3·고립 마커·문자열 오탐 방지·폴더 제외·CLI 실패/성공을 검사한다.

## 검증과 공개 범위

| 검사 | 복구 후 실제 결과 |
| --- | --- |
| `npm run check:conflicts` | 통과. 새 검사가 실패 커밋의 실제 마커93줄을 찾아내는 것도 별도 확인 |
| `npm run check:presentations` | 통과 |
| `npm run typecheck` | 통과 |
| `npm run lint` | 오류0, 기존 postcss 경고1 |
| `npm test` | 64/64 통과, 실패/skip0 |
| `npm run build` | 통과, conflict/presentation 선행 검사 포함 |
| `npm run test:browser` | 통과, 합성 API+실제 Chrome36개 검증 항목 |
| `npm run test:production` | 통과, 별도 로컬 production build/start+API 회귀 |

Chrome은 기존 로그인·회원/관리자 권한·객관식 단일/복수·변경/응답 손실·주관식·공지와 새 발표 탐색/필터/결과/초안/댓글 편집을 포함한다. 390/768/1440px 및 기존 작은 화면 회귀도 유지한다. 실기기 Safari와 실제 쿠키 디스크 유지는 미확인이다. lint의 기존 postcss anonymous export 경고와 Node의 module-type 경고는 충돌 파싱 오류와 별개다.

테스트는 가짜 회원과 로컬 HTTP DB fixture만 사용한다. 실제 PostgreSQL의 RPC·잠금·동시성이나 운영 회원 로그인 후 E2E를 검증했다는 뜻이 아니다. 새 댓글 수정용 RPC의 운영 적용은 별도 승인·검증 대상이며 이번 복구에서는 기존 SQL을 실행하지 않는다.

## GitHub와 배포 절차

로컬 `.git` 쓰기 제한으로 fetch가 FETCH_HEAD Permission denied로 실패했다. 원격 최신 main은 GitHub 연결 도구로 검증하고, 검증한 변경만 기존 main tree에 추가한다. 부모를 기존 main으로 지정한 일반 커밋과 `force=false`/expected SHA ref 갱신을 사용해 강제 push와 이력 삭제를 피한다. 새로운 원격 커밋이 있으면 먼저 비교한다.

사용자는 이번 요청에서 GitHub main 반영과 Production 배포를 명시 승인했다. 신규 커밋이 GitHub에 반영된 뒤 Git 자동 배포를 먼저 확인하고, 자동 배포가 없으면 동일 신규 커밋을 Git source로 명시해 배포한다. 실패한 e46d233 배포를 원인 수정 없이 Redeploy하지 않는다. Framework·Node·빌드/환경변수 설정은 관련 원인이 아니므로 바꾸지 않는다.

최종 확인은 신규 commit SHA, 배포 ID, READY, Production alias를 서로 대조한다. 인증 없이 가능한 로그인 페이지/보호 요청 검사는 로그인 후 전체 기능 E2E와 구분한다. 운영 DB 테스트 데이터는 만들지 않는다.

로컬 `.git` 제한 때문에 원격 반영 후 원래 브랜치가 새 SHA를 자동 가리키지 못할 수 있다. 로컬 파일은 보존하며 환경 밖 정상 터미널에서 fetch 후 비교·동기화해야 한다. reset/clean/force로 처리하지 않는다.

## 롤백 원칙

기존 READY 배포와 백업 커밋을 보존한다. 필요 시 승인된 이전 앱 배포를 사용하며 기존 votes/canonical 선택·게시글·댓글을 되돌리거나 삭제하지 않는다. 복수선택 도입 전 앱으로 무작정 되돌리지 않는다. 새 checker는 DB와 무관하며 오류가 나면 실제 파일/행을 검토한다.
