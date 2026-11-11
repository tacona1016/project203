# 203 PROJECT — Phase2 안정화·관리 개선

2026-11-11. 이번 작업은 코드/로컬 검증과 승인 전 적용 준비다. 로그인 정책·세션·비밀번호 매핑은 변경하지 않았다. **운영 DB migration, Production 배포, Secret 설정, 자동 백업 활성화는 별도 승인 대기**다.

## 1. 시작 상태

- GitHub main `45f275afb32c67748e8d43466291498fba97a1f5`, tree `95538d196f51c83c0f092cb6dcfbbbc4e31b9b3b`.
- Production `dpl_93DHptBYoduALYQZWcQ4hCsaJobA`, READY, 같은 SHA. 기존 Compact UI/500KB 압축 배포본을 기준으로 삼았다.
- 루트 `fix/rebase-integrity/e46d233`의 이전 미커밋 변경은 보존했다. `.verification/board-feature-branch`의 `release/production-20261108`에서 **`feat/phase2-admin-stability-20261111`**을 만들었다. root HEAD를 main으로 push하지 않는다.
- 시작274파일 해시 `.verification/phase2-baseline.json`, 주요 원본 `.verification/phase2-before/` 보관. 기존 기능을 다시 구현하지 않았다.

## 2. 구현 결과

| 영역 | 상태 | 구현 내용 |
| --- | --- | --- |
| 404 | 구현 완료·로컬 검증 완료 | 비회원용 header와 회원용 SiteHeader를 세션 기준으로 구분. 실제 Chrome 예외0/hydration오류0. 엄격한 Provider 누락 감지 유지. |
| 백업 도구 | 구현 완료·부분 로컬 검증 | public DB와 Storage를 별도 AES-256-GCM 암호화, SHA/크기/태그 검증, 원본 read-only snapshot, 비공개 S3 대상 검사, TEST 전용 복원 가드. |
| 자동 백업 | 승인 대기 | 수동 dispatch workflow만 작성. 기본 비활성, cron/삭제/공개 artifact 없음. |
| 독립 E2E 환경 | 준비 문서·가드 구현 / 실제 TEST 미완료 | 현재 전용 TEST 없음. 다른 운영 프로젝트를 재사용하지 않음. 테스트 SQL과 실행기 준비. |
| ADMIN 현황 | 구현 완료·합성 API 검증 | 단계/목표/다음 행동/기준일/내부 링크, 현황 비우기. 임의 운영 값 등록 없음. |
| ADMIN 일정 | 구현 완료·합성 API 검증 | KST 입력, 수정/취소·숨김/soft delete/복원, HOME 미래 일정 최대3개. |
| ADMIN 결정 | 구현 완료·합성 API 검증 | 실제 공지를 명시적으로 선택, 결정일·실제 투표 연결·표시 여부·후속 대체. 공지 제목/투표 종료로 자동 확정하지 않음. |
| HOME 일반 공지 | 구현 완료·합성 API 검증 | 결정 ID 제외를 LIMIT 전에 적용, 최신 일반 공지3건과 결정3건 분리, 삭제 제외·오류/빈 상태 구분. |
| Public Git 점검 | 읽기 전용 검사 완료 / 후속 승인 필요 | 과거 비밀번호 예시와 회원 seed 노출 위험, Secret 패턴/개인 사진/백업/Actions artifact 점검. |
| Compact UI | 보존 | HOME 발표→투표 인접 순서와 발표/BOARD/POLLS CSS 유지. ADMIN 관리 탭만 추가. |

## 3. 404 재현과 수정 근거

`layout`은 유효 회원 세션이 있어야 ParticipantProvider를 제공한다. 이전 not-found는 항상 SiteHeader → NameSelector → useParticipant를 렌더링했다. 합성 앱의 공개 `/access?fixture404=1`에서 `notFound()`를 호출하자 **SSR은404지만 실제 Chrome hydration이 `Authenticated member required.`로 실패**했다.

`app/not-found.tsx`만 세션별로 분기했다. 비회원은 Context 없는 로고/로그인 안내, 회원은 기존 header/홈 링크를 쓴다. DB 장애는 기존 ServiceUnavailable로 구분하고 기타 예외는 삼키지 않는다. 보호 페이지·API를 공개하거나 useParticipant 검사를 약화하지 않았다. 실제 앱에는 fixture URL 분기가 없고 테스트 복사본에만 주입된다. 미공개 발표자료는 기존 proxy의 plain404 정책을 유지한다.

## 4. 관리 데이터 설계와 호환성

신규 SQL은 **`supabase/proposals/project_admin_content.sql`**이다. Supabase CLI가 없고 실제 TEST 검증 전이므로 migration 적용 이력으로 가장하지 않는다. 승인된 TEST 검증 후 CLI로 새 migration 파일을 만들고 이 SQL 하나만 검토·적용한다. 기존 schema/seed/과거 migration 재실행은 금지한다.

- `project_admin_entries`: kind/status·event·decision + key, JSON 내용, 기존 Board FK, 실제 Poll slug 목록, 표시/삭제/대체 상태, version/수정자/시각.
- `project_admin_revisions`: 이전/이후 snapshot과 서버 세션의 수정자, 수정 시각. 기존 결정을 삭제하지 않고 이력을 남긴다. UI는 최근100건을 표시하고 DB는 전체 이력을 보존한다.
- RLS 활성화, PUBLIC/anon/authenticated 직접 권한 회수, service_role에 필요한 최소 권한. Supabase Auth UUID를 회원 UUID로 가정하지 않는다.
- 기존 회원+관리자 추가 인증과 Same-Origin 검사를 거친 `/api/admin/project`만 변경. 클라이언트 actor/role은 거부한다. SQL의 active actor 검사와 transaction lock/CAS로 동시 편집 손실·대체 순환을 차단한다.
- HOME용 RPC는 한 번에 상태/미래 일정/결정/일반 공지 제목을 제공한다. React cache는 해당 서버 렌더 요청 범위이며 회원 사이 공유 캐시가 아니다. 관련 투표는 실제 존재하는 비숨김 제목/URL만 노출하며 결과/응답을 읽지 않는다.
- 해당 신규 RPC가 **실제로 없는 경우만** 기존 파일 설정/contentLinks로 fallback. DB 장애·권한 오류를 빈 데이터나 파일 상태로 숨기지 않는다. migration 전 관리 UI는 편집을 비활성화하고 적용 필요 안내를 표시한다.
- 기존 `data/project-status.ts`, `project-plan.ts`, `content-links.ts`, `land-candidates.ts`를 삭제하거나 가짜 데이터로 채우지 않았다. 일정 타입에 선택적 description만 추가했다.

## 5. 백업과 복원

[BACKUP_RESTORE.md](BACKUP_RESTORE.md)에 설정·비용·주간4/월간12 보관 계획·수동 실행·TEST 복원·손실 대응을 정리했다. 원본 DB는 read-only이며 Storage는 실제 객체까지 암호화 스트리밍한다. snapshot 시점과 Storage 다운로드 사이 쓰기가 생길 수 있으므로 크기/ETag/ready SHA를 비교하고 불일치 시 실패한다. 강제 삭제나 원본 수정으로 해결하지 않는다.

백업 코드/수동 workflow 준비와 **실제 운영 백업 생성/원격 보관/독립 TEST 복원 성공은 별개**다. 로컬 pg 도구·저장소·암호화 키·TEST가 없어 후자는 미실행이다. 신규 유료 서비스·Secret 등록·`PROJECT203_BACKUP_READY`·schedule을 활성화하지 않았다. S3 region/저장량/서비스가 정해지지 않아 월 비용은 확정할 수 없다. [AWS 비용 항목](https://aws.amazon.com/s3/pricing/), [Supabase 플랜](https://supabase.com/docs/guides/platform/billing-on-supabase)

## 6. 공개 저장소 점검

- 현재 Public. 로그인해도 **커밋된 MDX·공개 SVG·SQL seed·문서는 GitHub에서 공개**된다. private-assets 사진은 ignore하며 현재 검사에서 Git에 등록된 실제 개인 사진/백업/환경 파일은 발견하지 못했다.
- 로컬에서 접근 가능한 과거 blob 중 `.env.example`에 현실적인 UUID/평문 비밀번호 예시가 있는 버전이 발견됐다. 위치: blob `854a3dd6112ba83a21d991013175c3d780e40ff0`. 실제 운영 비밀번호인지 확인하지 않았고 값을 출력하지 않았다. 현재 사용자 인증 설정은 변경하지 않는다.
- `supabase/seed_participants.sql`, `supabase/migrations/20261021_participants_and_vote_modes.sql`에 회원 seed가 공개된다. 일부 `supabase/tests/*`도 같은 패턴이지만 합성/실제 식별은 별도 검토한다. 이름/UUID 원문은 보고서에 재출력하지 않는다.
- 접근 가능한 현재/역사 파일에 Secret key/JWT/GitHub token/개인키 패턴을 검사했다. 발견 없음은 비밀 부재 보증이 아니다. unfetched/삭제된 원격 Git 객체·외부 복제본·모든 과거 로그까지 검사한 것은 아니다. Actions artifact 조회 결과0개였다.
- 권장 별도 조치: 소유자·협업자·GitHub App/Vercel private repo 권한 확인 → Settings/General/Danger Zone/Change repository visibility → Private 전환 승인 → Preview 연동 검사. 자동 전환하지 않았다. 실제 사용 중인 비밀이 노출된 것으로 확인되면 **관련 Secret 교체/접근 차단**을 별도 승인 후 수행한다. Git 역사 삭제만으로 해결하지 않는다.

## 7. 테스트

| 구분 | 결과 |
| --- | --- |
| `npm test` | **93/93 PASS**, skip0. 기존82+신규 프로젝트/백업/감사11. |
| `npm run test:integration` | **22검사 PASS**. 실제 Next API + 합성 DB/Storage 프로토콜. 실제 PostgreSQL transaction 증명과 다름. |
| `npm run typecheck` | PASS |
| `npm run lint` | 오류0, 기존 postcss 경고1 |
| `npm run build` | PASS; conflict/presentation 검사 포함 |
| `npm run test:browser` | **Chrome44검사 + 합성 HTTP23검사 PASS**. 390/768/1440px 새 관리 화면/HOME, 기존320/430px UI 검사 포함. 예외0/hydration오류0. OS 쿠키 저장 재개는 합성 쿠키 메모리 복원으로 별도 확인했으므로 실기기 영속성 미검증 |
| `npm run test:production` | **21검사 PASS**. 격리된 로컬 Next production build/start + 합성 DB/Storage. 실제 운영 검증이 아님 |
| 실제 PostgreSQL | **미검증**. TEST 미준비·psql 없음. 가드 실행은 `not_verified`로 실패 종료 |
| 실제 Storage | **미검증**. 운영에 테스트 객체 생성0 |
| 운영 암호화 백업·TEST 복원 | **미실행**. 설정 없는 preflight가 실패하는 것과 합성 암호화 검사만 확인 |
| Preview / Production | 이번 신규 코드의 Preview는 아직 미확인. Production은 기존 배포 보존, 신규 배포 안 함 |

반복 검증 중 발견한 실패도 숨기지 않는다. 공지를 추가한 fixture의 오래된 삭제 기대값을 고쳤고, plain404인 미공개 발표자료에 h1을 요구하던 새 브라우저 검사를 기존 계약에 맞게 수정했다. 개발 모드의 비동기 화면은 고정 지연 대신 실제 화면이 준비되기를 기다린다. **선택적 링크가 null인 저장 일정이 HOME에서 누락되는 실제 버그**를 Chrome에서 발견하여 null 허용과 단위 회귀 검사를 추가했고 최종 통과했다. 제품 인증/발표 정책을 테스트에 맞춰 바꾸지 않았다.

화면 검증 자료는 Git에서 무시되는 `.verification/member-browser/project-admin-{390,768,1440}.png`, 기존 compact 화면과 `report.json`에 있다. 실제 캡처를 확인했다. 가짜 회원/데이터만 사용하며 공개 PR artifact에는 올리지 않는다. 시작 해시 대비 기존 인증·이미지·발표·migration61파일 변경0, 삭제0이며 CSS는 신규 관리 선택자16줄 추가만 있다.

## 8. 변경 파일

- `app/not-found.tsx`: 비회원404 guard.
- `app/admin/project/page.tsx`, `app/api/admin/project/route.ts`, `components/admin/ProjectAdmin.tsx`, `AdminWorkspace.tsx`: 관리 페이지·API·진입 링크.
- `lib/project/model.ts`, `data.ts`, `lib/supabase/types.ts`: 공통 검증/타입/서버 접근과 RPC 타입.
- `app/page.tsx`, `components/home/ManagedProject.tsx`, `LatestNotices.tsx`, `UpcomingEvents.tsx`, `data/project-plan.ts`, `lib/board/notices.ts`: HOME 데이터 연결·공지 조회 순서.
- `app/globals.css`: 신규 관리 영역 scoped 스타일만 추가. 기존 슬라이드/Compact 스타일 보존.
- `supabase/proposals/project_admin_content.sql`, `supabase/tests/project_admin_content.sql`: additive 제안·TEST-only 검사.
- `scripts/project-backup.mjs`, `scripts/backup/core.mjs`, `.github/workflows/backup-manual.yml`, `.gitignore`: 암호화 백업·검증·기본 비활성 workflow와 TOC ignore.
- `scripts/test-project-database.mjs`, `scripts/audit-public-source.mjs`: TEST 가드·값을 출력하지 않는 감사.
- `tests/project-admin.test.mjs`, `backup.test.mjs`, `public-audit.test.mjs`, `tests/fixtures/project-server.mjs`, `board-server.mjs`, `tests/integration/project-admin*.mjs`, `member-auth.mjs`, `member-browser.mjs`, `website-features.mjs`, `home-stabilization.mjs`: 신규/기존 회귀 검사.
- `docs/BACKUP_RESTORE.md`, `ISOLATED_TEST_ENVIRONMENT.md`, 이 보고서, `SESSION_HANDOFF.md`: 적용과 미검증 범위.

## 9. 운영 적용 순서와 승인 대기

1. 기능 branch/PR CI 및 Preview 확인. main 병합은 이번 작업에서 수행하지 않는다.
2. 독립 TEST 프로젝트/비공개 bucket/가짜 회원과 전용 Secret을 승인 후 준비. Production Secret을 Preview로 복사하지 않는다.
3. TEST에 신규 SQL만 적용하고 TEST SQL·실제 회원/Storage E2E 수행. [체크리스트](ISOLATED_TEST_ENVIRONMENT.md).
4. SQL·이력 복구·권한 검토와 **운영 migration 별도 승인** 후 새 additive migration만 적용. 기존 데이터/투표/사진/RLS를 바꾸지 않는다.
5. Preview에서 연결 확인 후 **별도 Production 승인**으로 main 반영·배포. 앱의 기존 Production 환경변수 변경은 필요 없다. DB 적용 전에는 기존 파일 fallback으로 동작한다.
6. 백업 대상 저장소/암호화 키/접근자·비용 승인 → 실제 수동 암호화 백업 → 독립 빈 TEST 복원·앱 검증 → 수동 workflow gate 설정. 주간 예약과 정리 자동화는 그 이후 별도 승인.

앱 롤백은 기존 정상 Deployment/버전으로 되돌리고 신규 관리 테이블·이력은 그대로 둔다. SQL DROP/데이터 삭제/Storage 재생성을 롤백 수단으로 쓰지 않는다. 사용자별 패스워드·관리자 인증·투표 저장 방식은 변경하지 않았으며 기존 데이터에 테스트 쓰기도 하지 않았다.
