# 객관식 복수선택과 저장 확인

2026-11-01. 로컬 코드와 SQL 검증 후 사용자가 운영 반영을 승인했다. 현재 migration·GitHub·Vercel 반영을 진행하며 결과는 [세션 인계](SESSION_HANDOFF.md)에 기록한다. 환경변수와 회원 UUID, 비밀번호는 바꾸지 않는다.

## 투표 규칙

| 설정 | 동작 |
| --- | --- |
| `vote_mode=single` | 서로 다른 선택지 1개만 제출 |
| `vote_mode=multiple` | 최소 1개부터 전체 선택지까지 checkbox로 한 번에 제출. 같은 선택지에는 회원당 1표 |
| `allow_vote_change=false` | 최초 제출 후 추가·변경 불가. 기존 multiple에도 동일하게 적용 |
| `allow_vote_change=true` | 기존 선택 **집합을 교체**. A/B → A/C이면 B는 집계에서 제외되고 A/C만 각각 1표 |
| 주관식 | 기존 votes 저장과 1인 1응답·수정 정책 유지 |

과거 `allow_repeat_vote`는 호환 필드로 유지하지만 이제 true는 복수선택을 뜻한다. 반복 클릭 누적은 지원하지 않는다. 기존 multiple의 변경 허용 값은 false 그대로이며, 변경을 원하면 Admin Edit에서 명시적으로 켠다. 응답이 있는 Poll의 유형·모드·분기·선택지 변경 제한은 유지한다.

Admin에서 객관식 → **복수선택 허용**을 선택한다. **선택 변경 허용**은 single/multiple 모두 별도로 설정한다. 상시/기간제, Close/Reopen, Hide/Unhide, live/after_close는 기존 정책 그대로다.

## 저장 구조와 원본 보존

기존 `votes`의 객관식 행은 삭제·병합·수정하지 않는다. 기존 raw 집계를 재현할 수 있게 유지하고 주관식은 계속 이 테이블을 사용한다.

새 `poll_choice_selections`는 객관식 현재 상태다:

- PK `(poll_id, participant_id, option_id)`로 같은 회원·선택지의 물리적 중복도 차단한다.
- `is_selected`와 시각을 저장한다. 선택 취소는 false로, 다시 선택하면 같은 행을 true로 바꾼다. B의 행 자체를 지우지 않는다.
- 회원 UUID FK와 `(poll_id, option_id)` 복합 FK로 다른 Poll의 선택지가 섞이지 않게 한다. 이전 Dashboard 스키마에도 필요한 `poll_options(poll_id,id)` UNIQUE 인덱스를 추가한다.
- `submit_choice_ballot`이 Poll 행을 잠근 뒤 active 회원·유형·기간·수동 종료·숨김·선택지 배열·수정 가능 여부를 검증한다. 배열 중복을 제거하고 전체 선택을 단일 transaction에서 교체한다. 중간 예외는 전부 rollback한다.
- 원본 객관식 votes에 새로 쓰거나 기존 행을 수정하는 구형 경로는 차단한다. 구형 단일선택 RPC는 새 저장 방식에 위임하고, 구형 복수선택 반복 RPC는 거부한다.
- 새 테이블의 RLS를 켜고 anon/authenticated 직접 접근과 RPC 실행을 차단한다. Next.js가 회원 세션으로 작성자를 결정하고 서버 전용 키로 명시된 RPC만 호출한다.

`get_poll_results`는 현재 선택을 집계한다. `get_poll_legacy_results`는 보존된 원본 집계용 서버/SQL 진단 RPC이며 일반 API에 연결하지 않는다. 과거 raw 결과는 새로운 표가 추가되지 않는 역사 자료다. 새로운 객관식 응답까지 조회하려면 canonical 테이블도 반드시 백업해야 한다.

## 기존 중복과 승인

읽기 전용 운영 확인에서 총 votes 44행/Poll 4개 중, 같은 회원·같은 선택지의 중복 **2그룹·추가 3행**이 한 multiple Poll에 있었다. single의 서로 다른 선택 충돌은 없었다. 실제 회원·선택 내역은 보고에 포함하지 않았다.

중복을 새 테이블에 한 행씩 반영하면 해당 Poll의 집계는 기존 반복 클릭보다 **3표 감소**한다. 원본 행은 그대로 남는다. 운영 반영 직전 재확인에서는 실제 신규 참여로 전체 votes가 45행이었으며 중복 영향은 같았다. 사용자가 이 내용을 보고받은 뒤 운영 반영을 승인했다.

- 진단: `supabase/inspect_choice_ballots.sql`은 SELECT만 수행하며 Poll별 raw/예상 선택 수와 차이를 표시한다.
- migration: `supabase/migrations/20261101000000_choice_ballots.sql`.
- 중복이 있으면 migration은 기본적으로 예외를 내고 transaction 전체를 중단한다. **승인 전에 차단 조건을 우회하지 않는다.**
- 차이를 검토하고 사용자가 정규화를 승인한 경우에만 BEGIN 다음의 `SET LOCAL project203.approve_choice_normalization = 'on';` 주석을 해제하여 전체 파일을 실행한다. 이 문서는 지금 운영 실행을 승인하는 것이 아니다.
- single에 서로 다른 기존 선택지가 여러 개면 승인 설정이 있어도 중단한다. 임의로 한 선택을 고르지 않는다.
- 다시 실행해도 사용자가 취소한 선택을 복원하지 않는다. 원본에 있던 행이 canonical에 전혀 없을 때만 백필한다.

## 적용 순서와 되돌림

1. 현재 DB와 권한을 확인하고 [백업 절차](BACKUP_RESTORE.md)에 따라 별도 암호화 백업을 마련한다. 과거 schema/seed/migration을 운영에 일괄 재실행하지 않는다.
2. 진단 SQL로 raw 집계·정규화 효과를 검토한다. 필요하면 원본 집계를 별도 비공개 파일로 보관한다.
3. 기존 운영과 일치하는 schema를 가진 **별도 TEST DB**에서 신규 migration을 적용한다. 합성 중복으로 기본 차단/명시적 승인/재실행도 확인한다.
4. `supabase/tests/choice_ballots.sql`의 TEST 확인 설정을 켜고 실행한다. 이 파일은 합성 데이터와 오류 주입을 transaction 끝에서 rollback한다. 동시성은 하단의 두 세션 절차로 별도 검사한다.
5. 운영 적용 대상·집계 변화·검증 결과를 승인받은 후에만 신규 migration을 전체 실행한다. 실패로 transaction이 중단된 연결은 ROLLBACK한 뒤 원인을 해결한다.
6. SQL 적용 후 새 앱을 배포한다. 짧은 점검 시간 동안 작업하는 것이 좋다. SQL 적용부터 앱 배포 사이에는 구형 복수선택 요청이 거부될 수 있다. 환경변수 추가는 없다.
7. 회원/관리자 로그인, single/multiple/수정/주관식, 비공개 결과, 원본 보존, 새 테이블 권한을 확인한다. 신규 설치용 seed로 운영 데이터를 초기화하지 않는다.

신규 선택을 받은 뒤 이전 앱만 롤백하면 원본 votes를 읽는 구형 참여 UI와 현재 집계가 어긋날 수 있다. 원본만으로 새 선택을 복원할 수 없으므로 새 테이블을 삭제하거나 구형 schema를 덮어쓰지 않는다. canonical 구조와 호환되는 수정본으로 대응하는 것을 우선한다. 실제 복원/DB 변경은 별도 승인 대상이다.

## 피드백과 결과 공개

- DB 저장 확인 응답 이후 버튼 근처의 접근성 status 영역에 완료 메시지를 표시한다. 복수선택은 선택 개수와 각 1표 반영을 안내한다.
- 저장 중 checkbox/radio·버튼을 비활성화하고 동기 잠금으로 연속 submit도 차단한다. 서버 RPC 자동 재시도도 끈다.
- 응답 손실·5xx·잘못된 응답은 저장 실패로 단정하지 않는다. 본인 참여 GET만 조회해 전송한 집합과 일치하면 반영됨을 안내한다. 확인되지 않으면 추가 제출을 잠그고 **참여 상태 확인**만 제공한다. 자동 POST 재전송은 없다.
- 저장 성공과 결과 새로고침 실패는 구분한다. 결과를 못 불러와도 확인된 저장을 실패로 바꾸지 않는다.
- multiple은 참여자 수/총 선택 수를 구분하고 선택률을 참여자 기준으로 표시한다. 비율 합이 100%를 넘을 수 있다.
- `after_close`는 종료 전 결과·참여 수를 서버 응답에서 숨긴다. 자기 선택은 본인 API로 확인 가능하다. 수동 Close/기간 만료 후 공개하며 다시 ACTIVE로 열면 재차 숨긴다.

## 익명성 범위

현재 코드·운영 schema에 **별도 익명투표 설정은 없다.** 이번 작업에서 새 익명 모드를 만들거나 기존 주관식 실명 정책을 바꾸지 않는다. 객관식 일반/관리자 화면은 집계만 표시하고 본인 선택 조회는 세션으로 제한한다. 관리자 인증을 가져도 다른 회원 명의 제출·본인 기록 조회를 허용하지 않는다.

DB에는 중복 방지를 위한 participant_id가 남으므로 SQL 접근 권한을 가진 운영자까지 차단하는 강한 익명성은 아니다. 주관식 응답의 이름 공개는 기존 live/after_close·Admin 정책을 유지한다. Supabase의 anon DB 역할은 앱의 익명투표를 뜻하지 않는다.

## 검증 범위

`npm.cmd test`, lint, typecheck, build 및 기존 integration/browser/production 스크립트를 사용한다. 새 단위 tests는 배열 전송·불확실 오류·단일 요청을, HTTP tests는 저장·교체·중복·권한·공개 정책·원본 보존을 검사한다. Chrome은 checkbox/radio·완료 메시지·연속 제출·응답 손실·관리자 GUI를 검사한다.

로컬에 PostgreSQL/psql/Docker/CLI가 없고 npm 네트워크도 차단되어 **실제 PostgreSQL 쓰기 시나리오·두 연결 동시성은 미검증**이다. 합성 fixture 성공을 실제 DB 검증으로 간주하지 않는다. 운영 적용 시 합성 데이터를 넣지 않고 원본 보존·집계·권한·읽기 RPC만 확인한다. 적용 결과는 세션 인계에 별도 기록한다.

2026-11-01 실행 결과:

| 명령 | 결과 |
| --- | --- |
| `npm.cmd test` | 38개 통과 |
| `npm.cmd run lint` | 오류 0, 기존 postcss 익명 default export 경고 1 |
| `npm.cmd run typecheck` | 통과 |
| `npm.cmd run build` | MDX·TypeScript·production build 통과 |
| `npm.cmd run test:integration` | 합성 API·동시 요청·원본 보존·기존 기능 회귀 통과 |
| `npm.cmd run test:browser` | Chrome 390px/1440px, 성공/불확실 피드백·선택 변경·Close/Reopen·Admin GUI·로그인/게시판 통과 |
| `npm.cmd run test:production` | 합성 production build/start·Secure 쿠키·비밀값 canary·API 회귀 통과 |

문서 링크와 `git diff --check`도 확인했다. 인증 코드·Q4 MDX·dependency 파일은 이번 작업 시작 시 hash와 대조해 보존을 확인했다. 초기 브라우저 검사에서 발견한 결과 갱신 대기 문제와 관리자 폼 초기 연결 전 기본 제출 문제를 보완한 뒤 관련 검사를 통과했다. 실제 브라우저의 디스크 쿠키 복원은 기존 Windows 격리 환경 한계가 남아 있으며 합성 쿠키 복원 검사와 구분한다.

## 변경 파일

| 목적 | 파일 |
| --- | --- |
| DB·진단·TEST SQL | `supabase/migrations/20261101000000_choice_ballots.sql`, `supabase/inspect_choice_ballots.sql`, `supabase/tests/choice_ballots.sql` |
| 서버 계약·조회·저장 | `lib/supabase/types.ts`, `lib/supabase/queries.ts`, `lib/supabase/poll-errors.ts`, `app/api/polls/[slug]/votes/route.ts`, `app/api/polls/[slug]/participation/route.ts` |
| 입력·오류 분류 | `lib/polls.ts`, `lib/site-api.ts` |
| 회원 투표 화면·집계 | `components/interactive/PollForm.tsx`, `components/interactive/PollResults.tsx`, `components/interactive/TextBallot.tsx`, `components/polls/PollMeta.tsx`, `components/polls/PollCard.tsx`, `app/globals.css` |
| 관리자 설정·표시 | `components/admin/PollEditor.tsx`, `components/admin/AdminPollList.tsx`, `app/admin/polls/[slug]/page.tsx` |
| 자동 검증 | `tests/vote-client.test.mjs`, `tests/poll-settings.test.mjs`, `tests/fixtures/polls-server.mjs`, `tests/integration/member-auth.mjs`, `tests/integration/member-browser.mjs`, `tests/integration/choice-ballots.mjs`, `tests/integration/choice-browser.mjs` |
| 운영·인계 문서 | `README.md`, `docs/BACKUP_RESTORE.md`, `docs/POLL_CHOICE_BALLOTS.md`, `docs/SESSION_HANDOFF.md` |

관리자 폼도 이벤트 연결 전 기본 브라우저 제출이 발생하지 않게 초기 비활성화·POST method를 적용했다. 관련 SSR 및 브라우저 검증을 포함한다. 기존 회원 인증·Q4 MDX·환경변수·dependency 파일은 이번 변경에서 수정하지 않았다.
