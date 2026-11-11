# 독립 TEST 환경 준비

2026-11-11: 코드와 합성 HTTP/Chrome fixture를 준비했다. 이 프로젝트 전용 Supabase TEST와 Storage는 아직 없다. 조직의 다른 운영 프로젝트는 TEST로 사용하지 않는다. 실제 PostgreSQL/Storage E2E 통과를 뜻하지 않는다.

## 승인과 준비

1. 소유자가 별도 프로젝트의 생성 비용·지역·접근자·보관 기간을 승인한다. 현재 조직 Free/활성 프로젝트 2개 상태를 읽기 확인했으므로 추가 무료 프로젝트가 가능하다고 가정하지 않는다.
2. 새 TEST 프로젝트에 현재 앱 스키마를 준비한다. **운영 schema/seed/과거 migration을 재실행하지 않는다.** 복구 테스트용 빈 프로젝트와 앱 E2E용 프로젝트는 용도를 구분한다. 기존 운영 데이터 대신 가짜 UUID/이름/사진만 사용한다.
3. `board-attachments`를 Private/3MiB/WebP로 준비하고 서비스 역할만 객체에 접근하게 한다. 서버 전용 키와 TEST DB 비밀번호를 별도 비밀 저장소에 보관한다.
4. 아래 설정은 `.env.phase2-test.local`처럼 Git에서 무시되는 파일에 넣고 실행 프로세스에만 주입한다. `Get-Content`, env 전체 출력, `--debug`, Production Secret 복사는 하지 않는다.

| 변수 | 내용 |
| --- | --- |
| `TEST_ENV_CONFIRM` | `ISOLATED_TEST_ONLY` |
| `TEST_SUPABASE_REF` | 새 TEST의 20자리 project ref |
| `TEST_SUPABASE_URL` | 해당 ref의 `https://<ref>.supabase.co` |
| `TEST_DB_HOST` | `db.<TEST ref>.supabase.co` (현재 가드는 direct host만 지원) |
| `TEST_DB_USER`, `TEST_DB_PASSWORD` | TEST Connect 화면의 DB 연결 정보 |

```powershell
# 위 TEST 전용 변수와 psql을 준비한 뒤 실행. 운영 ref는 코드에서 거부한다.
node scripts/test-project-database.mjs --confirm-test --apply-proposal
node scripts/test-project-database.mjs --confirm-test
```

첫 명령은 **신규 제안 SQL 하나만** TEST에 적용한다. 둘째 명령은 `supabase/tests/project_admin_content.sql`을 transaction/rollback으로 검사한다. 신규 테이블/RPC/RLS/grants, 상태 버전 충돌, 일정 삭제/복구, 명시적 결정·순환 대체 거부를 검사한다. psql 또는 설정이 없으면 실패 종료하며 통과로 기록하지 않는다. 실제 PostgreSQL 테스트 전에는 production migration 파일로 승격하지 않는다.

## 실제 회원·Storage E2E 체크리스트

TEST 앱의 `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SECRET_KEY`는 TEST 프로젝트만 가리키게 한다. TEST `SITE_SESSION_SECRET`, `ADMIN_PASSWORD`, `BOARD_PARTICIPANT_PASSWORDS`는 합성 회원 A/B 전용으로 별도 생성한다. 실제 회원 UUID·비밀번호·Production 쿠키를 복사하지 않는다. Preview 설정 등록도 별도 승인 후 수행한다.

- A/B 로그인, 새로고침, 로그아웃과 비회원 API/사진 401; 일반 회원 ADMIN 403.
- A 글/댓글 생성·수정, B의 타인 수정 403, 좋아요 PUT 반복 1개/취소, 공지 관리자 전용.
- JPG/PNG/WebP 개별 업로드, 실제 Storage 다운로드 크기/DB byte_size/최종 SHA 일치, WebP·메타데이터 제거·500,000bytes 이하.
- 3장 제한/3MiB 초과/위조 MIME 거부, B 열람 가능·삭제 거부, 로그아웃 열람 차단. 업로드 오류 주입은 TEST에서만 하며 이미 저장된 글은 유지.
- 단일/복수선택/주관식/선택 변경/마감/비공개 결과. canonical `poll_choice_selections`와 `submit_choice_ballot`의 실제 transaction/동시성 검사.
- 프로젝트 현황·일정·결정 저장, HOME 반영, 동시 편집 409, 이력 복원, 숨김 투표 결과 비노출.
- 390/768/1440px Chrome; 필요 시 320/430px, Safari 실기기. 404 비회원/회원/로그아웃/뒤로가기/hydration.

각 항목은 대상 TEST ref의 식별용 별칭·코드 SHA·실행 시각·성공 여부만 기록한다. 행 본문, 사진, 쿠키, Secret을 보고서/공개 artifact에 넣지 않는다. 현재 이 체크리스트의 **실 DB/Storage 실행은 미완료**다. `npm run test:browser`는 실제 Chrome을 사용하지만 DB/Storage는 합성 fixture다.

## 운영 적용 게이트

TEST SQL·위 E2E 통과 → SQL 검토 및 운영 승인 → 신규 additive migration만 적용 → Preview 확인 → 별도 승인 후 Production. migration 제거·기존 공지/투표 삭제를 롤백으로 사용하지 않는다. 앱 버전 롤백 시 새 테이블과 이력은 보존한다.
