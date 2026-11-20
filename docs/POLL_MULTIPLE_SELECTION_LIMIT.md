# 복수선택 투표의 최대 선택 개수

2026-11-20. 개발·TEST 검증용 변경이며 운영 DB·Production 적용은 별도 승인 대상이다.

## 현재 상태와 기반

- GitHub main `1645aad5eea72d5cf182aea6784ed3e8fd92b6d5`, 기존 Production `dpl_2T5LuRqmj1gaaEnJEhxH2K45zvHa` READY를 다시 확인했다.
- 기존 PR #6(이미지 포함 원클릭 생성)은 OPEN, HEAD `223e69e5d6672e33c06c89805b7bfece727d706f`다. 해당 코드와 같은 tree `43f128b27036e0395a813bfa155aace075032719`를 기반으로 `feat/poll-multiple-selection-limit`에서 작업한다. 새 PR은 #6에 의존하며 #6을 덮어쓰거나 병합하지 않는다.
- 오래된 root 저장소와 미커밋 문서는 보존했다. 실제 작업 위치는 `.verification/board-feature-branch`다. Git fetch/npm 네트워크 제약 때문에 원격 조회·게시에는 연결된 GitHub 도구를 사용한다. 강제 업데이트하지 않는다.

## 구현

| 영역 | 동작 |
|---|---|
| 관리자 | 객관식+복수선택에만 제한 없음/2/3/4/5 표시, 저장 전 요약, 선택지 수 초과 안내·저장 차단 |
| 참여 이력 | `votes` 또는 canonical 선택 이력이 한 건이라도 있으면 변경 잠금. 선택을 모두 해제한 이력도 포함. 다른 수정 가능 설정 유지 |
| 회원 | 선택지 위 최대값/현재 개수 표시, N+1 변경 이벤트 거부, 기존 체크 유지·해제 허용, 키보드 동일 동작, 제출 직전 재검증 |
| API | 서버 세션/동일 출처/ID 검증 유지. 중복 ID 정규화 후 cap 초과 HTTP 400, DB의 독립 거부도 400 |
| RPC | `submit_choice_ballot`의 부모 행 잠금·고유 ID 집합 검증 후 cap을 검사하고, 기존 원자적 전체 선택 집합 교체 유지 |
| 직접 DB 쓰기 | 기존 부모 잠금에 deferred 최종 활성 선택 수 제약 추가. 일시적으로 N+1을 거쳐 정상 교체하는 트랜잭션은 최종 집합으로 판단 |
| 기존 무제한 | 신규 컬럼 NULL, 기존 행 backfill/삭제/재계산 없음. 이전 앱이 새 필드를 생략한 수정은 기존 cap을 보존 |
| DB 미적용 | 무제한 생성/수정·기존 HOME/POLLS 정상 동작. non-null cap 저장은 컬럼 존재 확인 뒤 수행하며 미적용 시 503 안내. 전체 SQL을 원자적으로 적용해야 함 |

`selection_limit_exceeded`는 **저장 전 거부** 결과다. `P2035`는 참여 이력 이후 cap 수정 거부다. 기존 `P2034`(보관된 객관식 원본 표 보호)는 재사용하지 않았다.

`has_responses`는 관리자 상세에만 추가한다. 일반 회원 상세에는 집계 비공개 여부를 우회하는 새로운 참여 이력 정보도 보내지 않는다. 결과 집계·공개 정책·참여자 수 RPC는 교체하지 않는다.

## 신규 SQL과 동시성

파일: `supabase/proposals/poll_multiple_selection_limit.sql`.

- `polls.max_choices_per_participant smallint NULL`과 `choice/multiple/2~5` CHECK만 추가한다. 기존 poll/option UUID·ID, 표, 원본 votes, 참가자, 이미지 테이블은 재생성하지 않는다.
- 2026-11-20 실제 운영 `pg_get_functiondef`를 **읽기 전용**으로 확인한 최신 validate/create/update/detail/ballot/guard 정의에 변경을 결합했다. 과거 migration의 오래된 RPC로 되돌리지 않았다.
- 설정 변경 이력 잠금, cap≤실제 선택지 수 deferred 제약, canonical 선택 수 deferred 제약을 추가한다. 기존 PK `(poll_id,participant_id,option_id)`와 prefix 인덱스를 사용하며 새 인덱스는 불필요하다.
- 설정·선택지 편집·선택 저장은 동일 부모 poll을 잠근다. 기본 READ COMMITTED와 SERIALIZABLE 경로를 사용한다. REPEATABLE READ는 잠금 대기 후에도 오래된 snapshot을 유지할 수 있으므로 canonical 쓰기/선택지 쓰기/제한 변경을 `40001`로 거부한다. 기본 PostgREST 요청은 영향을 받지 않는다. 실제 격리 수준·동시 연결 동작은 독립 TEST 확인 전이다.
- 새 함수는 SECURITY INVOKER, 빈 search_path, server-role 실행만 허용한다. 기존 RLS/브라우저 직접 접근 차단을 완화하지 않는다. Storage/Secret 변경은 없다.
- 트랜잭션 전체 성공 후 schema cache reload를 통지한다. 일부 컬럼만 수동 적용하지 않는다.

근거: [PostgreSQL 17 constraint trigger](https://www.postgresql.org/docs/17/sql-createtrigger.html), [transaction isolation](https://www.postgresql.org/docs/17/transaction-iso.html). 트랜잭션 종료 시점 검사를 사용한 이유는 정상적인 선택 교체의 중간 상태를 최종 결과로 오인하지 않기 위해서다.

## Migration 등록·TEST·운영 적용 순서

운영 PostgreSQL17.11, 기존 polls RLS와 CHECK, 신규 cap 컬럼 미존재를 읽기 전용으로 확인했다. 현재 Supabase CLI/psql/Postgres/docker가 없고 별도 203 TEST 프로젝트도 연결되어 있지 않다. timestamp migration 등록이나 실제 SQL 적용을 수행했다고 주장하지 않는다. 완성된 SQL을 **미적용 migration 제안**으로 보관한다.

1. 독립 TEST 프로젝트와 psql/CLI를 준비한다. Production Secret·회원 비밀번호를 복사하지 않는다.
2. CLI `--help`와 프로젝트 migration 이력을 확인하고 `supabase migration new poll_multiple_selection_limit`로 새 migration을 등록한다. 생성 파일에 위 SQL을 그대로 넣는다. 과거 migration을 재실행하거나 무조건 `db push`하지 않는다.
3. TEST의 현재 스키마/RPC 기준과 proposal을 재대조하고 신규 SQL만 한 번 적용한다. 기존 앱/신규 앱 양쪽 호환성을 확인한다.
4. `PROJECT203_TEST_DATABASE_URL`을 독립 TEST 연결로 설정하고 `PROJECT203_TEST_DATABASE=isolated`로 확인한 뒤 `node scripts/test-poll-choice-limit.mjs`를 실행한다. URL/Secret을 로그에 출력하지 않는다. 이 스크립트는 알려진 운영/관련 없는 프로젝트 연결을 거부하고 SQL 검증 및 실제 두 연결 동시성을 확인한다. 테스트 행은 TEST에만 생성·정리하며 SQL 단위 검증은 ROLLBACK한다(시퀀스 증가 자체는 되돌아가지 않음).
5. 독립 TEST 환경변수의 Preview에서 실제 회원·PostgreSQL E2E를 수행한다. 환경변수가 없는 READY는 앱 흐름 검증으로 간주하지 않는다.
6. PR #6 의존성, CI, TEST 결과 검토 후 운영 SQL·Production 배포를 **별도 승인**받는다.
7. 승인 후 `supabase/tests/poll_choice_limit_preservation.sql`의 집계 지문/행 수를 전후 대조하고 신규 SQL만 적용한다. 동시 실제 사용자 변경은 별도 구분한다. 신규 앱 배포 후 제한 없음과 제한 투표를 확인한다. 운영 테스트 글/표/사진을 만들지 않는다.

롤백은 우선 앱만 이전 정상 배포로 돌리고 신규 컬럼·제약·설정·모든 응답은 보존한다. 이전 UI는 새 제한 안내가 없을 수 있으므로 제한된 새 투표의 편집·참여 UX를 따로 확인한다. 컬럼 삭제·NULL 일괄 변경·기존 응답 삭제는 자동 복구 절차가 아니다.

## 테스트 상태

| 검사 | 결과 |
|---|---|
| 단위 테스트 | 122/122 PASS. NULL/2~5, 위조 값·모드·옵션 수, 기존 코덱 포함. SQL 정적 검사는 PostgreSQL 실행 검증과 구분 |
| Typecheck | PASS |
| ESLint | 오류 0, 기존 postcss 경고 1 |
| check:conflicts / check:presentations | PASS |
| 신규 HTTP | 실제 Next API+합성 Supabase 프로토콜 4묶음 PASS. 1..N/N+1, CRUD/기존 ID, 오류·인증·미적용 DB·중복·평행 HTTP 포함 |
| 신규 Chrome | 최종 Production 모드 320/390/430/768/1440px PASS, 예외0/hydration0. 390px는 cap+질문/선택지 사진을 한 번에 생성·공개하는 PR6 연계도 PASS |
| 전체 integration / browser / build | `test:integration` HTTP23묶음, `test:browser` HTTP24묶음+Chrome45항목, Production Build PASS |
| PostgreSQL/실제 두 연결 | **미실행**. 전용 runner는 TEST 설정 부재로 종료코드2 반환. 합성 평행 HTTP는 실제 DB 락 증거가 아님 |
| 실제 Storage / 운영 회원 E2E | 미검증. 운영 콘텐츠/데이터/이미지 쓰기0 |

초기 합성 테스트의 일반 회원 관리자 API 예상값을 실제 기존 정책인 403으로 수정했다. 신규 기능의 개발 모드 Chrome 집중 검사는 두 번 실패했다(첫 실행 hydration 대기, 재검사 생성 완료 화면 대기). 반복 HMR/재로딩을 관찰했으나 원인을 확정하지 않았다. 같은 최종 앱의 Production 모드에서 실제 관리자 목록→생성 화면 경로, cap+사진 원클릭 생성 및 5폭 흐름은 모두 PASS다. 일반 dev 전체 Chrome45 회귀도 PASS이며 개발 모드 집중 검사 실패를 통과로 바꾸어 기록하지 않는다. SQL 준비 중 치환 도구의 `$` 이스케이프 오류도 검토에서 발견해 수정하고 정적 회귀 검사를 추가했다. 운영 DB에는 실행하지 않았다.

## 변경 파일

- UI: `components/admin/PollEditor.tsx`, `components/interactive/PollForm.tsx`, `components/polls/PollMeta.tsx`.
- 공통/서버: `lib/poll-choice-limit.ts`, `lib/polls.ts`, `lib/site-api.ts`, `lib/supabase/types.ts`, `lib/supabase/poll-admin.ts`.
- API: `app/api/admin/polls/route.ts`, `app/api/admin/polls/[slug]/route.ts`, `app/api/polls/[slug]/votes/route.ts`.
- SQL/실행기: `supabase/proposals/poll_multiple_selection_limit.sql`, `supabase/tests/poll_multiple_selection_limit.sql`, `supabase/tests/poll_choice_limit_preservation.sql`, `scripts/test-poll-choice-limit.mjs`.
- 테스트: `tests/poll-choice-limit.test.mjs`, `tests/fixtures/polls-server.mjs`, `tests/integration/poll-choice-limit.mjs`, `tests/integration/poll-choice-limit-browser.mjs`, `tests/integration/member-auth.mjs`, `tests/integration/member-browser.mjs`.
- 문서: 이 문서, `docs/SESSION_HANDOFF.md`.

보호 대상 61개 파일의 기존/현재 Git blob hash가 모두 같다. 기존 이미지 생성 흐름, 질문·선택지 이미지 확대, BOARD 500KB 압축, 좋아요, 회원/관리자 인증, Compact HOME/MDX/공개 정책 코드는 보존한다. 새 패키지나 브라우저 저장소·폴링을 추가하지 않는다. CSS/기존 migration/Storage 설정 변경 및 파일 삭제는 없다.

## GitHub / Preview

최종 로컬 검증 후 #6에 의존하는 별도 PR을 main 대상으로 생성하고 CI/Preview를 기록할 예정이다. 실제 PostgreSQL TEST 검증 전에는 병합하지 않는다. Production과 DB는 기존 유지다.

QA 스크린샷·로그·RPC 읽기 스냅샷은 ignored `.verification/`에만 보관하며 GitHub에 업로드하지 않는다.
