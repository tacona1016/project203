# 세션 인계

## 2026-11-11 — Phase2 안정화·관리 기능 진행

- 로컬 최종 완료: test:production도21검사 PASS(로컬 build/start+합성 DB/Storage). 이전 단위93/Chrome44/HTTP23/type/lint/build 결과와 구분해 보관했다. .verification/member-auth-report.json은 마지막 production fixture 결과이며 Browser 보고서는 별도 member-browser/report.json에 보존. 실제 운영회원/PG/Storage·백업복원은 미검증.
- 코드 checkpoint: 검토 repo 기능branch의 67072c4d3a715b3047989d1a77ee7a4d574d3a37, tree5a8233a2dff5dc7835d67ab479aabf7afde7ae57, parent45f275a.38파일/삭제0·normal commit. 이후 검증 문서만 후속 commit으로 갱신한다. Git fetch443 실패이므로 동일 오류를 반복하지 않고 연결 GitHub 도구의 전체 tree 대조 전송을 준비한다. 원격 main/Production/운영SQL 변경 없음.

- 최신 검증: 단위93/93, typecheck/lint(오류0·기존경고1)/Production Build(conflicts·presentation 포함) PASS. test:browser는 실제 Chrome44 + 합성 HTTP23 PASS, 예외0/hydration0. 신규관리 UI/HOME390/768/1440·기존320/430 포함. 링크 없는 일정의 null href가 HOME에서 제외되는 실제 버그를 Chrome에서 찾아 수정+회귀1개 추가. 테스트 중 plain404와 Suspense 준비 시점을 구분하도록 기대/대기를 보완했다. OS 쿠키 저장 영속성·실PG/Storage는 미검증. test:production 로컬 production fixture 검사 진행 중.
- 보존: 시작 기준274파일에서 삭제0, 인증/사진/발표/기존SQL61파일 해시 동일. CSS는 기존 규칙 무변경·새관리16줄만 추가. 이번 변경38파일을 검토 repo 기능branch에 명시적으로 복사했다(아직 커밋/PR 전). 루트 기존 dirty/HEAD 보존. 현재 원격main45f275a·Production dpl_93DHptBYoduALYQZWcQ4hCsaJobA READY/SHA일치를 재조회했다.

- 구현 완료: 비회원404 hydration 예외를 실제 Chrome에서 재현 후 not-found만 세션별 header로 분리. 엄격한 useParticipant/인증 정책은 유지. /admin/project의 현황·일정·명시적 결정·복구 이력 UI/API, CAS409/원자적 SQL proposal, HOME 공유 조회/미적용 파일 fallback/장애 안내, 일반 공지의 결정 제외를 LIMIT 전에 적용했다.
- 백업: scripts/backup/core.mjs + project-backup.mjs, 암호화/해시/가드/삭제 없는 보존 계획, 비활성 backup-manual workflow 작성. BACKUP_RESTORE 최신11테이블/실제 Private Storage로 갱신. TEST SQL/가드 실행기와 ISOLATED_TEST_ENVIRONMENT.md 준비. 운영 암호화 백업/복원/스케줄 활성화는 미실행.
- 수정 파일 묶음: app/not-found,page,admin/project,api/admin/project; components/admin/ProjectAdmin,AdminWorkspace,home/ManagedProject,LatestNotices,UpcomingEvents; lib/project/*,lib/board/notices,lib/supabase/types; data/project-plan; globals.css,.gitignore; scripts/backup*,audit-public-source,test-project-database; supabase/proposals/project_admin_content.sql,tests SQL; 관련 unit/HTTP/Chrome 테스트와 문서. 시작274파일 해시와 비교하여 이번 변경만 별도 branch에 통합할 예정.
- 현재 검사: 단위92/92 PASS. 합성 HTTP22항목 PASS(실제 DB 아님); typecheck PASS, lint 기존경고1/신규경고는 제거. 404 fix 포함 새 Chrome+관리 UI390/768/1440은 실행 중. 마지막 Production Build/TEST SQL/실Storage는 아직 완료 아님.
- 공개 점검: 운영 branch273파일/로컬 reachable역사556blob 패턴검사에서 과거 .env.example의 현실적인 UUID/평문 비밀번호 예시(high)와 일부 participants seed 공개(medium) 확인. 실제 현재 운영 비밀번호와의 일치 여부는 조회하지 않음. 값은 출력하지 않았고 저장소Private/Secret교체는 승인 대기. Actions artifact 조회0개. 패턴스캔은 노출부재 증명이 아님.
- 다음: Chrome 실패 수정·최종 type/lint/build·preservation 해시, 실TEST/복원 미검증 범위 보고, PROJECT203_PHASE2_IMPROVEMENTS.md 작성, 검토 repo 기능branch에 명시적 파일만 반영·PR/CI/안전Preview 가능 여부 확인. main/Production/운영SQL/Secret/과금은 변경하지 않는다.

- 목표: 404 Provider 의존 오류, 암호화 DB/Storage 백업 도구, 독립 TEST 준비, ADMIN 현황/일정/결정 관리, HOME 일반 공지 누락 수정, 공개 Git 점검. 로그인 정책/세션/매핑·운영 DB/Secret/Production 배포는 이번 작업에서 변경하지 않는다. 이전 배포 승인을 확대 적용하지 않는다.
- 시작 확인: 원격 main45f275a/tree95538d·Production dpl_93DHptBYoduALYQZWcQ4hCsaJobA READY 유지. 루트 기존 dirty 보존. 별도 검토 repo에 release/production-20261108을 기준으로 feat/phase2-admin-stability-20261111 생성. 시작274파일 해시 .verification/phase2-baseline.json, 주요 원본 phase2-before/에 보관.
- 실제 메타데이터: public 앱11테이블 모두 RLS, board-attachments Private/3MiB/객체1개. 행/사진 원문은 조회하지 않았다. 조직 Free·활성프로젝트2개, 이 프로젝트의 독립TEST 없음. psql/pg_dump/docker/Supabase CLI/암호화 CLI가 로컬 PATH에 없어 실PostgreSQL 복원/새 migration 실행은 불가하며 코드·SQLproposal/TEST 절차를 준비한다. 비용/Secret/프로젝트 생성은 승인 전 미실행.
- P0 분석: layout은 세션이 있을 때만 ParticipantProvider, not-found는 무조건 SiteHeader→NameSelector→useParticipant. 로그인 공개 route에 fixture 전용 notFound를 넣은 실제 Next SSR404는 통과했다. 클라이언트 hydration 재현·검사는 현재 실행 중이며 아직 예외 재현 완료라고 보고하지 않는다.
- 다음: 404 Chrome 결과→최소 guard 수정, additive 프로젝트 관리 SQL·서버/API/UI·미적용 fallback, HOME 결정 제외를 limit 전에 적용, 암호화 백업/검사/TEST 복원 가드·수동 workflow, 회귀·build·Chrome·보안 audit, 기능 branch/PR·안전Preview. 모든 변경/검사 결과를 단계마다 갱신한다.

---

## 2026-11-08 — Production 릴리스 완료

- 이번 사용자의 명시적 배포 승인으로 정상 PR 병합과 자동 Git Production 배포를 완료했다. 새 기능을 다시 개발하지 않았다. DB/Storage/RLS/Auth/회원·관리자 비밀번호/환경변수/과금/저장소 공개 범위 변경 없음.
- GitHub 시작 main71457ceb1ed82f6440bc0649129cf6bd3621be13 → 최종 main **45f275afb32c67748e8d43466291498fba97a1f5**. PR **https://github.com/tacona1016/project203/pull/2**, 정상 rebase merge. 원격 기능 commit968d82a8f74007a4b0111e170b71d772a67356bd와 기존 로컬 ee2e978/3d445fa의 tree **95538d196f51c83c0f092cb6dcfbbbc4e31b9b3b**가 모두 같다.50파일 전체 반영, 삭제0, 인증/API/SQL/패키지 변경0. 기존 원격 이력/로컬 커밋 보존·force 없음.
- PR Actions **42484558653 / job128743475142** 실제 성공: npm ci, 단위82/82, typecheck, lint, build(conflict/presentation 포함). 기존 로컬 Chrome43·HTTP21·production-mode HTTP19는 동일 코드 명세를 대조하여 재사용했다.
- 신규 Production **dpl_93DHptBYoduALYQZWcQ4hCsaJobA**, **READY**, Git source/main SHA45f275a 일치, https://project203.vercel.app 연결 확인. 배포 URL https://project203-3219vfzav-project203.vercel.app . Git 연동 자동 배포만 사용했으며 기존 파일 Preview를 승격하거나 중복 수동 배포하지 않았다. 이전 정상 dpl_AnfDMN7vwsMv33ccErSakvSqk7o1은 보존했다.
- 신규 빌드 로그 compile/Build Completed/Deployment completed 확인, 실패 오류0. 기존 npm/ESM/Node 범위 경고는 유지했다. 신규 deployment의 최근15분 error/fatal 런타임 로그 조회는 일치 로그 없음(전체 기능 E2E 보증 아님).
- 실제 운영 HTTP(무인증): /access200 로그인 화면; HOME/ARCHIVE/POLLS/BOARD/ADMIN/Q4 요청은 로그인 화면으로 이동(조회 도구는 최종200을 반환). /api/polls·/api/admin/polls·보호사진401. HTML private/no-store 확인. 실제 회원 로그인 후 UI/Storage 업로드는 미검증이며 운영 테스트 데이터 생성0.
- Preview Git 배포 dpl_73BrF7ddpp6g7gyFPY8524UuFWL8/968d82a READY. /access503 연결 안내·/api/polls401. 필수5변수는 Production에만 있는 상태 그대로이며 값은 복호화·출력·복사·변경하지 않았다. Preview 회원 E2E/Safari/실제 Storage E2E 미검증은 남는다.
- Git 보존: root는 fix/rebase-integrity/e46d233의 이전 dirty 작업 그대로다. 별도 검토 repo .verification/board-feature-branch의 원래 통합 브랜치3d445fa는 clean·보존했다. 공개된 원격968d82a/45f275a commit 객체를 SHA 검증하여 읽어오고 새 로컬 ref **release/production-20261108 →45f275a**를 추가했다. 기존 refs는 이동하지 않았고 connectivity fsck 통과. 후속 Git 작업은 원격 최신을 재확인하고 배포 ref를 사용한다. 오래된 root main/통합 snapshot을 그대로 main으로 push하면 안 된다.
- 완료 보고서: **docs/PRODUCTION_RELEASE_20261108.md**. .verification/release-source.json은50파일 blob SHA, release-validation.json은 배포/CI/HTTP/보존 영수증이다. 이번 최종 보고/인계는 배포 뒤 로컬 문서로 기록하며 추가 문서 전용 Production 배포를 만들지 않았다.
- 남은 작업: 별도 테스트 DB/회원이 있는 Preview 설정과 실제 로그인·Storage E2E는 후속 승인 범위. 이번 배포 목표는 완료. 운영 migration·환경변수 변경은 필요 없고 실행하지 않았다.

아래는 릴리스 이전 진행 기록이다. 현재 배포 결과는 위 완료 기록을 우선한다.

---

## 2026-11-08 — 승인된 Production 릴리스 진행

- PR #2의 Validate application CI 성공: npm ci·단위82/82·typecheck·lint·build(내부 conflict/presentation 포함) 통과. Git Preview dpl_73BrF7ddpp6g7gyFPY8524UuFWL8/968d82a READY 확인. Preview 환경변수는 변경하지 않았다.
- PR을 expected-head968d82a로 정상 rebase merge 완료. main 신규SHA45f275afb32c67748e8d43466291498fba97a1f5, tree95538d196f51c83c0f092cb6dcfbbbc4e31b9b3b로 검증된 로컬 tree와 동일.71457ceb 이전 이력/원격 기능 브랜치/기존 로컬 커밋 모두 보존했다. 강제 push·규칙 우회 없음. 자동 Production 배포를 확인 중이며 중복 수동 배포는 하지 않는다.

- 현재 요청은 검증된 통합 코드의 정상 push/PR 병합/Production 배포에 대한 명시적 승인이다. DB migration·데이터 삭제·환경변수/인증·과금 변경은 승인 대상이 아니며 하지 않는다. 아래 이전 승인 대기 문구보다 이번 요청을 우선한다.
- 시작 재확인: main71457ceb, 기존 Production dpl_AnfDMN7vwsMv33ccErSakvSqk7o1 READY·도메인 연결. Public 저장소 유지. 필수5환경변수는 값 복호화 없이 Production에만 존재함을 재확인했다. Preview 설정 변경 없음.
- root fix/rebase-integrity/e46d233 dirty와 모든 기존 작업 보존. 별도 검토 repo의 clean HEAD3d445fa → ee2e978 →71457ceb 정상.273파일 명세 동일·50파일 변경·삭제0·인증/API/SQL/패키지 변경0. 이전82단위/Chrome43/HTTP21/production HTTP19/build 근거와 동일 코드이므로 중복 무거운 테스트는 생략하고 실제 PR CI를 확인한다.
- 로컬 fetch/push는 GitHub443 연결 실패. 동일 오류를 반복하지 않고 GitHub 연결 도구로50파일을 전송했다. 원격 tree95538d196f51c83c0f092cb6dcfbbbc4e31b9b3b가 로컬3d445fa tree와 정확히 같다. metadata가 다른 신규 원격 commit968d82a8f74007a4b0111e170b71d772a67356bd 생성, parent71457ceb. 기존 로컬/원격 이력은 보존했고 force는 사용하지 않았다.
- 원격 기능 브랜치 fix/stabilization-ux-integrated-20261108, PR https://github.com/tacona1016/project203/pull/2 생성 완료.50파일 전체 tree 검증, private-assets/.env/.verification 업로드 없음.
- 진행 중: PR CI·mergeability/보호 규칙 확인 → 통과 후 정상 병합 → 자동 Production 신규SHA/READY/alias/log/비로그인HTTP 검증. 운영 로그인 후/실제 Storage E2E는 회원 비밀번호 없이 미검증으로 남긴다.
- 아직 main 변경/Production 배포/DB·Storage·환경변수 변경 없음. 릴리스 최종 결과를 이 문서와 배포 보고서에 이어 기록한다.

---

## 2026-11-08 — 안정화/UI 통합 최종 검증

- 최종 Git checkpoint: 별도 .verification/board-feature-branch 저장소의 **fix/stabilization-ux-integrated-20261108**, 코드 commit **ee2e978c33e6ed2d98bc77004345b92cc0592005**, 직접 parent는 실제 최신 원격71457ceb다. root refs/기존 dirty/기존 브랜치들은 보존했다. 원격3커밋·trees/blobs를 SHA 검증 후 읽어와 connectivity fsck 통과. 원격 대비50파일(기존 Compact/압축 포함), 새 작업20파일. SQL/인증/API/패키지의 원격 대비 변경 없음. 코드 commit 후 이 영수증/보고서만 문서 후속 commit으로 남긴다. push/main/Production 변경 없음.

- 현재 목표: 기존 Compact UI·500KB 압축을 보존한 통합과 HOME 실제 현황/빈 영역/확정 결정 탐색 개선. **로컬 구현/검증 완료, Preview READY, Production 승인 대기**다. 실제 값은 projectStatus=null·contentLinks=[]·확정 일정/후보지 없음으로 유지한다.
- 완료: 최신 발표→투표 실제 DOM 인접 유지, 빈 일정/공지/결정 생략·DB 실패 안내 구분, 실제 목표/다음 행동/기준일/안전한 내부 링크 지원, 명시적 결정 공지 ID만 최신3건·실제 비숨김 관련 투표 연결, 공지 중복 제거. CSS 중복9선택자·통계 breakpoint 정리·HOME 간격 토큰·dialog 색상 수정. PR 검증 workflow 작성(원격 실행 전).
- 이번 변경은20파일이며 정확한 목록/이유는 docs/PROJECT203_STABILIZATION_AND_UX.md G절. 시작268파일·이전 구현은 .verification/stabilization-baseline.json 및 stabilization-before에 보관했다. 기존 Compact/압축을 다시 개발하지 않았다.
- 최종 검사: 단위82/82, typecheck/lint(오류0·기존경고1)/conflict/presentation/Production Build 통과. test:browser는 Chrome43 + 합성 HTTP21항목 통과. test:production은 로컬 production build/start + 합성 HTTP19항목 통과. 390/768/1440 신규15화면과 기존320/430 검사 포함. uncaught 예외0/hydration 오류0. 실제 DB/Storage 쓰기 E2E와 구분한다.
- 보존: 인증/API/SQL/Storage/사진/MDX 등104파일 시작 해시 동일, 발표 CSS 규칙 동일, 파일삭제0. Preview로 보낸 앱189파일도 현재 코드와 모두 동일. 사진500,000bytes/원본3MiB/3장/과거사진열람·해시/재시도·좋아요·투표·결과 정책 회귀 통과.
- Preview: dpl_DuRLCrrEWi9BuJnrNWk5Jruq2qYx, https://project203-2pf0w3psh-project203.vercel.app, READY, target=null. 파일 API 배포라 배포 Git SHA는 없으며 앱 manifest digest cd68a6feba4777369796e602c70353bd6138f2d233c2163e881393ad10a54a69로 식별한다. env/개인사진/fixture는 업로드하지 않았다.
- Preview HTTP: /api/polls·보호사진401, /access·로그인으로 이동한 Archive503 연결 안내. 필수5변수 이름/target만 decrypt=false 조회: Production에만 적용, Preview에는 없음. 실제 회원 Preview E2E는 미완료이며 환경변수 복사/변경·인증 우회는 하지 않았다.
- Production: 도메인을 마지막으로 재조회해71457ceb1ed82f6440bc0649129cf6bd3621be13/dpl_AnfDMN7vwsMv33ccErSakvSqk7o1 READY 유지 확인. 기존 로그인 화면200·비로그인 API/사진401·Archive 로그인 이동 확인. 로그인 후 운영 E2E는 미검증. 운영 데이터·DB/RLS/Storage/Auth/환경변수와 GitHub main 변경 없음.
- Git: root fix/rebase-integrity/e46d233의 기존 dirty 상태/백업 브랜치 보존. root fetch는 .git 쓰기 제한, review fetch는 네트워크 실패. 연결 도구로 원격262파일 확인(로컬 누락0), 마지막 원격3commit/tree/blob를 SHA 그대로 검증 후 별도 review 저장소에 적재했고 fsck connectivity 통과. 기존 refs/작업은 보존했다. 최신 원격71457ceb를 부모로 하는 위 통합 커밋/브랜치 구성을 완료했다. 오래된 root main을 push하지 않는다.
- 해결한 검사 오류: Suspense 전송 HTML의 숨은 조각 순서/문자열을 실제 화면으로 취급하던 검사를 settled DOM·가시 상태 요소로 변경. 최종 통과. scratch 문서 전송의 PowerShell smart quote/명령 길이 제한은 작은 ASCII JSON 청크와 SHA 검증으로 해결했으며 앱·기존 파일 손상 없음. 기존 ESM/npm/Node 범위 경고만 남았다.
- 미완료/다음: 별도 테스트 DB/회원이 있는 Preview 설정은 후속 승인 → 실제 회원 E2E → main/Production은 사용자 승인 후 적용. 새 SQL·신규 운영 환경변수는 필요 없다. GitHub PR workflow 실실행·Safari/OS 쿠키 영속성·실제 PG/Storage 동시성은 미검증이다. 통합 코드·검증·문서는 완료했으므로 다시 만들지 않는다.
- 증거: .verification/stabilization-{baseline,candidate,changed-files,preservation,preview-source,browser-http-report}.json, member-browser/{report,stabilization-console,compact-measurements}.json 및 compact-*.png. 보고서는 docs/PROJECT203_STABILIZATION_AND_UX.md. 새 승인 없이 운영 반영하지 않는다.

아래 진행 기록은 위 최종 결과 이전 상태다.

---

## 2026-11-08 — 운영 안정화 및 UI/UX 통합 진행

- 현재 목표: 기존 Compact UI/500KB 압축을 보존하고 HOME 빈 영역·실제 현황·명시적 결정 탐색을 개선한다. 운영 DB/Storage/Auth/환경변수 변경, main push, Production 배포는 이번 요청에서 승인 전 금지다.
- 시작 확인: root fix/rebase-integrity/e46d233, 기존 dirty 파일 보존. rebase/merge/index 충돌·stash 없음. root fetch는 .git/FETCH_HEAD Permission denied. 연결 GitHub 도구로 main71457ceb1ed82f6440bc0649129cf6bd3621be13/Public 재확인. Vercel Production dpl_AnfDMN7vwsMv33ccErSakvSqk7o1, 동일 SHA, READY·도메인 연결 재확인.
- 보존 확인: Compact 최종27파일은 인계 문서 외 해시 동일, 압축 최종 명세 모두 동일. 요청의 .verification/compact-measurements.json은 없으며 실제 자료는 member-browser/compact-measurements.json이다. 다른 지정 산출물은 존재한다. 새268파일 시작 해시는 .verification/stabilization-baseline.json, 수정 전 주요 파일은 stabilization-before/에 보관했다.
- 안전 브랜치: 별도 검토 저장소 .verification/board-feature-branch의 기존 clean feat/board-likes-images/e855bec를 보존하고 fix/stabilization-ux-20261108 생성 완료. root refs/dirty는 변경하지 않았다. 최종 코드 스냅샷은 검증 뒤 이 브랜치에 통합 예정이며 아직 commit/push 없음.
- 구현: 빈 공동 일정은 null 반환, 빈 공지/결정 영역 숨김, 조회 실패 안내 분리. 기존 contentLinks의 명시적 decisionPostIds만 실제 미삭제 notice와 일괄 대조해 최신3건/존재하는 비숨김 투표 링크 표시. title 추정·새 DB 메타데이터 없음. projectStatus는 null 유지, 값이 있을 때 goal/안전한 내부 관련 링크 표시 지원. HOME 발표→투표 인접 유지, 투표0개는 짧은 안내.
- CSS: 동일 무조건 선택자9개 통합, 중복 통계 breakpoint 제거, HOME 간격 토큰·상태 유동열, 이미지 dialog의 정의되지 않은 색상 변수를 기존 paper/ink로 수정. 발표 슬라이드/목차/MDX는 변경하지 않았다.
- 변경 파일(현재): app/page.tsx, app/globals.css, components/home/{LatestNotices,ProjectTasks,UpcomingEvents}.tsx, components/polls/PollCatalog.tsx, data/{project-status,content-links}.ts, lib/board/notices.ts, 새 lib/home-decisions.ts·tests/home-decisions.test.mjs·tests/integration/home-stabilization.mjs·.github/workflows/validate.yml, 기존 fixture/통합 테스트, 이 문서. 새 CI는 PR 검사 전용이며 배포/DB 쓰기/secret 사용 없음.
- 테스트: 초기 typecheck 오류 출력 없음. 전체 단위 테스트 실행 중이며 결과 아직 확정하지 않았다. 브라우저/통합/최종 lint·build·보존 해시 대조 미완료.
- 다음: 단위 결과 확인 → 변경 타입/lint/build → 합성 HTTP+Chrome390/768/1440(필요 시320) → 브라우저 콘솔/사진/투표 회귀 → 보호 파일 해시 → 검토 브랜치 스냅샷 통합 → 안전한 Preview 가능 여부 및 HTTP 검사 → docs/PROJECT203_STABILIZATION_AND_UX.md와 인계 결과 갱신. 실서비스 E2E와 fixture 결과를 구분한다.

---

## 2026-11-08 — Context 압축 전 최신 요약

재개 시 이 요약을 먼저 읽고 현재 Git diff와 대조한다. 아래 11월 4일 기록은 이전 구현·검증 이력이며, 최신 작업 범위와 배포 제한은 이 요약을 우선한다. 이번 요청은 맥락 정리이므로 이 문서만 갱신하며 코드·설정·Git 이력·외부 서비스는 변경하지 않는다.

### 1. 현재 개발 목표와 요구사항

- 직전 개발 목표는 **UI/UX 간결화와 HOME 재배치**이며, 구현·로컬 검증·보고서까지 완료했다. 현재 진행할 미완성 구현은 없다.
- HOME 실제 DOM 순서: 소개 → 최신 발표자료 → 투표 현황 → 프로젝트 현황/다음 행동 → 최신 공지 → 장기 로드맵 → 공동 일정 → 실제 후보지가 있을 때만 후보지 비교. 발표자료와 투표는 연속된 형제 섹션이어야 한다.
- 과한 제목·여백·배너·중복 안내를 줄이고 기존 컬러(#fffefa/#f2f2ed/#20241f/#2453df)와 디자인을 유지한다. 모바일390px·태블릿768px·PC1440px 대응을 확인했다.
- 기존 인증·서버 API·DB/RLS·투표 저장/공개 정책·BOARD 좋아요·사진 압축·MDX와 발표 슬라이드 자체는 변경 대상이 아니다.
- **가장 최근 개발 요청에서 main Push 및 Vercel Production 배포는 별도 승인 전 금지했다.** 과거의 일반적인 자율 배포 승인보다 이 작업의 구체적 제한을 우선한다. 이번 요약 요청은 배포 승인이 아니다.

### 2. 완료된 작업 / 미완료 작업

- 완료: HOME React 렌더 순서 변경, 현황/할 일 통합, 미정 항목 반복 제거, HOME 투표 최대3개·미참여 우선·중복 요약 제거.
- 완료: 간결한 PollCard·투표 필터, BOARD112/144px 배너·검색/글쓰기 상단 배치·전체 행 터치, Archive 접이식 검색, Admin 주요 행동 상단 배치·통계/폼 간격 축소, 한글 메뉴.
- 완료: 이번 UI 시작 시점 대비 기존23파일 수정/신규4파일. 목록은 `docs/UI_COMPACT_REDESIGN.md`와 `.verification/compact-changed-files.json`에 있다.
- 완료·보존: 직전 사진 압축 작업은 신규 BOARD 사진을 WebP **500,000bytes 이하**로 저장한다. 원본3MiB·글당3장·기존 이미지 열람 정책은 유지한다. 이 압축 변경도 아직 운영 배포하지 않았다.
- 미완료 구현: 없음. 운영 반영은 승인 대기이며, 실제 운영 E2E·Safari 실기기·독립 PostgreSQL/Storage 환경 검증은 미수행이다.
- 프로젝트 상태는 실제 합의 전이므로 `projectStatus=null`을 유지한다. 가짜 상태·일정·후보지·금액을 추가하지 않았다.

### 3. 주요 설계 결정

- HOME 순서는 CSS order 대신 JSX 순서를 변경했다. `QuarterCover` 원본은 유지하고 HOME 범위 CSS만 조정했다. 발표 슬라이드 간격·목차·이동 UI는 그대로다.
- HOME 투표 정렬은 표현 전용 helper다. ACTIVE·비숨김만, 미참여 → 확인 불가 → 참여 완료, 같은 그룹은 마감순 → 최근 등록순, 최대3개. 서버 결과 공개 판단과 DB 조회 구조는 바꾸지 않는다.
- 결과 비공개 투표는 집계·타인 응답·참여율을 새 UI에도 노출하지 않는다. 참여 조회 실패를 미참여0개로 꾸미지 않는다.
- 공통 회원 인증은 활성 UUID/개인 비밀번호 검증 후30일 HttpOnly 세션, 관리자 추가 인증은8시간이다. 작성자·투표자는 서버 세션에서 결정한다. Supabase는 서버 전용이며 기존 RLS/grants를 유지한다.
- 사진 압축은 Sharp raw 디코딩/회전 후 품질82→76→70→64→58→52→45, 최대변1920→1600→1280→1024→800을 탐색한다. 최대35후보/20초, EXIF 제거·투명도/비율 유지, Storage 업로드 직전 크기 재검증. 기존 사진은 재압축하거나 삭제하지 않는다.
- 새로운 DB/환경변수/의존성 없이 개선했다. 기존 복수선택 `poll_choice_selections` / `submit_choice_ballot`을 구형 반복 투표로 되돌리면 안 된다.

### 4. 핵심 파일과 코드 구조

- `app/page.tsx`: HOME 실제 섹션 순서, `data-home-section` 식별자, 최신 공개 발표자료, 기존 서버 인증 유지.
- `app/globals.css`: 일반 페이지와 HOME에 한정한 compact 규칙 추가. 기존 CSS 원문과 발표 스타일 보존.
- `components/home/{ProjectTasks,LatestNotices,ProjectRoadmap,UpcomingEvents}.tsx`: 통합 현황, 공지/로드맵/일정 표시. `data/project-status.ts`는 수정하지 않았다.
- `lib/home-view.ts`(신규): HOME 투표 최대3개 정렬. `components/polls/PollCatalog.tsx`: 기존 회원별 catalog 사용, 반복 목록 제거.
- `components/polls/{PollCard,ParticipationRate,PollDeadline,QuarterPolls}.tsx`: 목록 밀도·두 축 필터·선택적 상세 표시. `app/polls/page.tsx`는 제목 정리.
- `app/board/page.tsx`: 검색/글쓰기와 목록 배치. 기존 BoardEditor/BoardComments/좋아요/사진 처리 코드는 이번 UI에서 변경하지 않았다.
- `app/archive/page.tsx`: 자료가6개 이하이고 검색 조건이 없으면 필터 접기. `components/SiteNav.tsx`/`SitePage.tsx`: 한글 메뉴와 설명 스타일, URL 유지.
- `components/admin/{AdminWorkspace,AdminPollList}.tsx`: 투표 만들기/공지 작성 우선, 통계·분기·관리 목록 간격.
- `tests/home-view.test.mjs`, `tests/integration/compact-browser.mjs`(신규): 정렬/최대 개수/실제 화면 검증. 기존 `member-auth.mjs`, `member-browser.mjs`, `ui-ux-browser.mjs`에 통합했다.
- 사진 압축 보존 파일: `lib/board/{image-codec,image-policy,image-data,image-client}.ts`, `components/board/{BoardImagePicker,BoardImageGallery}.tsx`, `tests/board-image-codec.test.mjs` 등. 상세는 `docs/BOARD_IMAGE_COMPRESSION.md`.
- 이번 최종 보고서: `docs/UI_COMPACT_REDESIGN.md`. 이전 BOARD 기능 보고서: `docs/BOARD_LIKES_IMAGES_IMPLEMENTATION.md`.

### 5. GitHub / Supabase / Vercel 상태

- **2026-11-08 로컬 재확인:** branch `fix/rebase-integrity`, HEAD `e46d233ab28b283e1e0274f5b54eded62002b9ab`. 기존 여러 작업의 수정/미추적 파일이 남아 있다. clean 상태가 아니다. Rebase/Merge 진행 없음, Git unmerged index 없음, `git diff --check` 통과(CSS CRLF→LF 안내만 있음).
- root HEAD가 실패 커밋을 가리켜도 현재 working tree에는 이전 복구와 후속 구현이 있으므로 HEAD로 덮어쓰지 않는다. `reset --hard`, clean, 강제 push, 미커밋 변경 폐기 금지. root `.git` 쓰기는 현재 환경에서 제한된다.
- 별도 로컬 검토 저장소 `.verification/board-feature-branch`가 있다. 이전 체크포인트 `e855bec`는 현재 원격 최신으로 간주하지 않는다. Git 작업 전 루트/검토 저장소/원격을 다시 대조해야 한다.
- 마지막 외부 확인 기록: GitHub/Production commit `71457ceb1ed82f6440bc0649129cf6bd3621be13`, Vercel `dpl_AnfDMN7vwsMv33ccErSakvSqk7o1` READY, 도메인 `project203.vercel.app`. 근거는 `.verification/board-features-validation.json`이다. **오늘 외부 서비스의 최신 상태를 재조회하지 않았으며 이 값은 과거 기록이다.**
- 이전 BOARD 좋아요/사진 기능의 DB migration `20261103143211_board_likes_images`, `20261103143219_board_attachments_bucket`은 이미 운영 적용한 기록이 있다. Private `board-attachments` 버킷과 신규3테이블/RPC도 당시 적용했다. 기존 migration/schema/seed를 재실행하거나 `supabase db push`로 이력을 무조건 맞추지 않는다.
- 이번 UI·직전500KB 압축은 GitHub Push/Production 배포/운영 DB·Storage 쓰기/환경변수 변경을 하지 않았다. 추가 SQL 적용은 필요 없다. 기존3MiB Storage 설정은 그대로 두고 신규 저장 크기를 서버에서500,000bytes로 제한한다.
- 저장소 Public 기록은 있으나 오늘 공개 범위를 재조회하지 않았다. 개인 사진·비밀·백업을 공개 Git에 추가하거나 저장소 설정을 임의로 바꾸지 않는다.

### 6. 테스트 결과 / 오류 / 미검증

- **2026-11-04 마지막 코드 검증:** `npm test`80/80, typecheck 통과, lint 오류0/기존 `postcss.config.mjs` 경고1, check:conflicts/check:presentations 통과, 최종 Production Build 통과.
- `npm run test:browser` 실제 Chrome42항목 통과. 동일 harness의 합성 HTTP20항목도 통과. 별도 `test:integration` 명령을 중복 실행한 것은 아니다. 실제 운영 PostgreSQL/Storage 테스트와 구분한다.
- 신규390/768/1440px 15화면, 기존320/430px 검증 포함. HOME 순서/발표와 투표 인접/첫 화면 발표 버튼, 필터, 메뉴, BOARD 편집·좋아요·사진 UI, Admin을 검증했다.
- 기존 미정 안내 문구 기대값과 숨은 스트리밍 HTML 조각을 먼저 측정하던 브라우저 타이밍을 보완했고 최종 테스트 실패는 없다. 현재 남은 항목은 기존 lint 경고1과 외부 검증의 한계다.
- 미검증: 운영 로그인 후 E2E, 실제 DB/Storage 쓰기·동시성, Safari/iPhone 실기기, OS 차원 브라우저 재실행 영속성. Chrome harness는 synthetic cookie를 메모리에서 복원하므로 OS 영속성과 다르다.
- 검증 증거: `.verification/compact-validation.json`, `compact-changed-files.json`, `member-auth-report.json`, `member-browser/report.json`, `member-browser/compact-measurements.json`, `member-browser/compact-*.png`.
- Before12장은 직전 실제 Chrome 캡처의 동일 시작 UI이고 이번에 재촬영한 Before는 아니다. `.verification/compact-before/`에 보관한다. QA 산출물은 Git ignored이므로 다른 기기에서 자동 제공되지 않는다.
- **2026-11-08 요약 전 재확인:** 최종 UI 명세27파일 해시가 모두 일치했다. 이전 UI 검증은 인증/API/DB/압축/MDX 등120개 보호 파일 해시 동일·파일 삭제0개·기존 CSS 원문 보존도 확인했다. 이번 문서 갱신 후에는 인계 문서 해시만 의도적으로 달라진다. 과거 검증 명세를 새 테스트 결과로 덮어쓰지 않는다.
- 오늘은 코드 변경이 없어 테스트/빌드를 다시 실행하지 않았다. 위 결과는11월4일 실행 기록이며 오늘 실행한 결과로 표현하지 않는다. 실행을 재개해야 할 중단된 명령은 없다.

### 7. 다음에 이어서 진행할 작업

1. 재개하면 이 문서, `git status`, `git diff`, `.verification/compact-changed-files.json`을 먼저 비교한다. 완료한 UI/압축 구현을 다시 만들지 않는다.
2. 사용자의 다음 지시를 확인한다. 현재는 요약만 요청했고 배포 승인은 없으므로 자동 Push/배포하지 않는다.
3. 운영 반영을 승인받으면 원격 main/Production 최신 상태를 읽기 전용으로 확인하고, 기존 로컬 복구·BOARD·압축·UI 작업을 보존한 검토 가능한 변경 묶음을 준비한다. 오래된 root HEAD를 그대로 push하거나 force/reset으로 원격에 맞추지 않는다.
4. 실제 배포할 변경 묶음이 검증된 로컬과 다르면 관련 테스트·typecheck·lint·build를 실행한다. 변경이 없으면 통과한 무거운 테스트를 이유 없이 반복하지 않는다.
5. 승인된 새 커밋의 배포 READY/실제 커밋/도메인을 확인하고 로그인 이후 기능 검증은 별도로 기록한다. DB/Storage/환경변수 변경은 이번 UI·압축 적용에 필요 없다. 운영에 테스트 게시글/투표/회원/사진을 생성하지 않는다.

---

## 2026-11-04 현재 작업 — 간결한 UI와 HOME 재배치

- 목표: 소개 → 최신 발표자료 → 투표 → 통합 현황/할 일 → 공지 → 로드맵 → 일정 → 실제 후보지 순서로 React 렌더링을 바꾼다. 일반 페이지의 제목·여백·목록 밀도를 조정하고390/768/1440px를 실제 Chrome으로 확인한다.
- 시작 상태: root의 기존 Git/미커밋 작업과500KB 압축 구현을 보존한다. 시작 해시259파일은 .verification/compact-baseline.json, 기존 실제 Chrome 비교용12장은 .verification/compact-before에 보관했다. 소개/여백·중복 현황/투표 설명·BOARD 배너·Admin 상단을 분석했다.
- 보호 범위: 사진 압축/업로드·서버 인증/API/DB/RLS/MDX·Presentation 컴포넌트와 슬라이드 스타일은 바꾸지 않는다. 이번 요청에 따라 main push/Production 배포는 수행하지 않는다.
- 구현 완료: HOME DOM 순서 변경, 통합 프로젝트 현황, 중복 없는 최대3개 투표와 미참여/마감/최근순 정렬, 간결한 PollCard/두 축 필터, BOARD 배너/전체 행 터치/검색, Archive 접이식 검색, Admin 상단 행동/통계·폼 여백, 한글 메뉴. 기존 발표 슬라이드 규칙은 그대로 두고 Home QuarterCover만 한정 조정했다.
- 수정 파일: 이번 시작 시점 대비 기존23개/신규4개. app/page·globals·polls·board·archive, SiteNav/SitePage, home4개, project/LandComparison, polls6개, admin2개, 통합 테스트3개, 새 home-view helper/단위/Chrome 검증, 인계와 docs/UI_COMPACT_REDESIGN.md. 이전 Git diff의 BOARD/압축 변경은 이번 작업으로 계산하지 않는다.
- 최종 검증: 단위80/80, typecheck 통과, lint 오류0/기존 postcss 경고1, check:conflicts/check:presentations·최종 Production Build 통과. 실제 Chrome42항목과 합성 HTTP API 통합 검증 통과. 신규390/768/1440px 15화면과 기존320/430px 검증도 포함한다.
- 실측: HOME 이미지160/224px,390px 화면 발표 버튼 하단746px. BOARD 배너112/144px, 행 약75/51px. 가로 넘침 없음, HOME 발표→투표 DOM 인접, 최대3개·미참여 우선·필터/Archive 접기/Admin 상단 행동 확인. 운영 수치가 아닌 합성 fixture 측정이다.
- 해결한 오류: 이전 미정 안내 문구를 기대한 테스트를 갱신했다. 스트리밍 숨은 조각의 높이0을 측정한 Chrome 검증은 표시된 목록을 기다리게 보완했다. 최종 실패 없음.
- 보존 검증: 인증/API/DB/BOARD 편집·좋아요·500KB 압축/MDX/발표 컴포넌트 등120파일 시작 해시 동일, 기존 CSS 원문 유지, 삭제0개. 변경/검증 명세는 .verification/compact-changed-files.json와 compact-validation.json에 보관한다.
- 산출물: docs/UI_COMPACT_REDESIGN.md, .verification/member-auth-report.json, member-browser/report.json(42), compact-measurements.json, compact-*.png. Before12장은 직전 실제 Chrome 캡처의 동일 시작 UI이며 이번에 새로 촬영한 Before는 아니다.
- 다음: 구현·로컬 검증·보고서 완료. 이번 요청상 push/Production 배포는 승인 후 진행한다. DB/Storage/환경변수 변경은 필요 없다. 승인 후 원격과 root의 기존 미커밋 작업을 다시 확인하고 변경 묶음을 보존한다. 이미 통과한 검사는 새 변경이나 실패가 없으면 반복하지 않는다.
- 미검증: 운영 배포/E2E, Safari 실기기, 실제 PostgreSQL/Storage 통합 및 OS 차원 브라우저 재실행 영속성. 운영 DB·Storage·회원·사진을 변경하거나 테스트 데이터를 생성하지 않았다.

아래는 이전 작업 기록이다. 현재 목표는 위 UI 변경이며500KB 압축은 보존 대상이다.

## 2026-11-04 현재 작업 — 신규 BOARD 사진 500KB 자동 압축

- 목표: 원본 JPG/PNG/WebP 3MiB·사진3장 정책을 유지하면서 신규 저장 WebP만500,000bytes 이하로 제한한다. 이번 요청은 push/Production 배포를 승인 전 금지하므로 수행하지 않는다.
- 분석: 기존 단발 quality82/최대2400px/출력3MiB를 확인했다. 기존 조회의3MiB 한도와 DB/Private bucket 설정은 보존한다. DB migration·Storage 설정 변경은 필요 없다.
- 완료: 신규 storedBytes500000/최대1920px, 품질82→76→70→64→58→52→45와 해상도1920→1600→1280→1024→800을 순서대로 탐색한다. 원본은 한 번 디코딩/회전하고 raw픽셀에서 재압축한다. 최대35후보·전체20초 deadline/Sharp timeout, 투명도 유지/EXIF 제거, 업로드 전 별도 크기 검증을 구현했다.
- UI: 자동 압축/원본 제한 안내, 선택/압축·업로드/실패/완료와 최종KB 표시. 본문 저장 후 개별 사진 처리 흐름은 유지했다.
- 수정: lib/board/image-policy.ts,image-codec.ts,image-data.ts, BoardImagePicker/BoardImageGallery, codec 단위/합성 이미지 fixture/기존 이미지 API·Chrome 회귀. 정확한 시작 해시는 .verification/compression-baseline.json에 보관했다.
- 완료 검사: npm test78/78, typecheck/Production Build 통과, lint 오류0/기존 경고1. 실제 Next HTTP API+Chrome40항목 통과. 신규 저장bytes/DB 크기/최종hash·반복 요청·실패 복구·과거500KB 초과 사진의 동일bytes 열람을 확인했다.390/768/1440px UI도 통과했다.
- 실측:1.10MB→485470bytes/1280x960/q45,2.76MB→474044bytes/1280x960/q58. 전체 표와 파일 목록은 docs/BOARD_IMAGE_COMPRESSION.md, 합성 결과는 .verification/compression-samples.json에 보관한다.
- 해결한 오류: 알파 비교 테스트에서 raw출력 누락, Sharp 타입namespace 표기 오류를 수정했다. 실제 알파/회전/기한·손상/초과 검사는 모두 통과했다.
- 최종 검토: 이번 변경 파일과 시작 해시를 대조하고 기존 인증/투표/댓글/좋아요/MDX/SQL을 보존했다. 삭제0개. 검증 기록은 .verification/compression-validation.json에 보관한다.
- 다음: push·배포는 이번 요청의 명시적 승인 전 금지다. 승인 후 앱 코드만 적용하면 되며 DB/Storage/환경변수 변경은 없다. 실제 운영 업로드·Linux 배포·Safari 검증은 이번 작업에서 수행하지 않는다. 완료한 코덱/브라우저 검사는 새 변경이나 실패가 없다면 반복하지 않는다.

아래는 이전 BOARD 기능 배포 기록이다. 현재 작업에서는 위 목표와 배포 제한을 우선한다.

2026-11-03. 비밀번호·키·쿠키·실제 회원/사진/개인정보는 기록하지 않는다. 재개 시 이 문서와 Git diff, .verification/board-features-validation.json을 먼저 대조한다.

## 현재 개발 목표

BOARD 수정 검증·게시글/댓글 좋아요·비공개 사진 최대3장 구현을 마치고 사용자 사전 승인에 따라 신규 DB/Storage와 GitHub/Vercel까지 반영했다. 일반 개발 승인 범위는 docs/DEVELOPMENT_AUTHORIZATION.md와 AGENTS.md에 기록했다. 파괴적 작업·RLS 완화·과금 변경은 별도 확인한다.

## 완료한 작업

- 게시글/댓글 기존 수정 UI·RPC·권한을 재사용했다. 댓글 본인 수정/관리자 삭제와 공지/고정 정책을 유지했다.
- 좋아요는 게시글/댓글 복합 PK, 서버 세션 기준 멱등 PUT/DELETE, 낙관 UI/실패 복원/상태 확인, 댓글 페이지 일괄 조회로 구현했다.
- 사진은 개별3MiB·JPG/PNG/WebP 실제 검증·Sharp 재인코딩/EXIF 제거·Private bucket·회원 전용 no-store 응답이다. 작성자만 관리하고 사진3슬롯/회원75MiB/전체750MiB를 제한한다.
- pending/ready/deleting·UUID/해시·lease·원자적 claim으로 중단/실패를 추적한다. 본문 저장 후 사진을 처리하고 부분 실패 재시도에서 글을 중복 생성하지 않는다. 미리보기·삭제 취소·확대/ESC·기존 초안과 호환한다.
- 신규 migration20261103143211_board_likes_images,20261103143219_board_attachments_bucket 적용 완료. 새3테이블/RPC10개·Private3MiB/WebP 버킷. 과거 migration/schema/seed와 기존 edit_board_comment는 재실행하지 않았다.
- 운영 DB RLS·직접 browser 접근 차단·SECURITY INVOKER/server 실행·실제 조회 RPC 확인. Security Advisor 경고0. 기존8테이블 전체 행 지문이 전후 동일하다. 새 테이블0행이며 가짜 회원/게시글/사진은 생성하지 않았다.
- 원격03118e2 위에 기능4811b7e2420a85744b354c8580ce1f52e62d31a5를 만들고 main fast-forward 성공.42파일/의도 밖 변경0/삭제0. feat/board-likes-images도 보관했다.
- 기능 Production dpl_kG7pYMxX3cNo3AwuZfaEmrbGw6uD READY, 운영 도메인project203.vercel.app 연결 확인. 동일 코드 Preview도 READY이며 Production만 기존 필수 환경변수가 있다. 환경 값은 읽거나 바꾸지 않았다.
- Vercel Linux 설치/Next16.4.2 빌드 통과. 기존 engines>=22가26을 선택하는 경고와 npm/ESM 경고는 설정 변경 없이 기록했다. 마지막 상태 기록 commit은 기능 코드를 바꾸지 않는다.

## 수정한 파일

- 신규 API: app/api/board/posts/[id]/like, comments/[commentId]/like, images 및 images/[imageId].
- 기존 BoardEditor/BoardComments/상세 페이지·CSS·lib/board/data/types·Supabase types 연결.
- 새 BoardLikeButton/BoardImagePicker/BoardImageGallery와 engagement/feature-http/image-policy/image-codec/image-data/image-client.
- 새 SQL proposal2개·실제 서버 발급 version migration2개·TEST SQL·명시적 정리 도구. Sharp0.35.5 직접 의존성(package/lock), fixture/단위/API/Chrome 회귀.
- README/Board 운영 문서/BOARD_LIKES_IMAGES_IMPLEMENTATION, AGENTS.md/DEVELOPMENT_AUTHORIZATION와 이 문서. 상세42파일은 .verification/board-release-paths.json.
- 기존 인증/투표/발표/과거 migration44파일 시작 해시 보존. 기존 루트 복구 작업은 덮어쓰지 않았다.

## 미완료 작업과 제한

- 실제 TEST PostgreSQL 다중 연결 동시성 및 실제 Storage 업로드/삭제 E2E. 별도 테스트 DB/회원 계정이 없고 운영 데이터에 테스트 행을 넣지 않았다.
- 운영 사이트 HTTP/로그인 후 실제 기능 검증: 로컬 Node/PowerShell 네트워크 실패, Vercel URL fetch 대상 접근 오류, 공개 웹 조회 접근 불가로 미완료. READY는 운영 E2E 통과를 뜻하지 않는다.
- Safari 실기기·로컬 fresh npm ci·장기 cleanup 실행. HEIC/AVIF/댓글 사진·자동 정리 스케줄은 범위 밖이다.
- 원본 .git 쓰기 제한으로 root는 fix/rebase-integrity/e46d233 및 기존 dirty 상태를 보존했다. 별도 로컬 검토 저장소 .verification/board-feature-branch에는 e855bec 체크포인트가 있다. 실제 GitHub는4811b7e 이후 상태다. 향후 Git 작업 전 원격과 working tree를 재대조하며 reset/force push로 맞추지 않는다.

## 발생한 오류와 처리

- Esc 중단은 파일 묶음 준비 중 발생했다.42파일 전체 내용과 원격/DB 적용 여부를 확인한 후 재개했다. SQL을 중복 적용하지 않았다.
- root .git/fetch 제한과 로컬 네트워크 실패는 연결된 GitHub/Supabase/Vercel 도구의 허용된 기능으로 작업했다. 접근 정책을 우회하거나 인증 정보를 취득하지 않았다.
- 로컬 npm offline cache 부족: 이미 설치된 동일 잠금 Sharp로 테스트했다. 이후 Vercel Linux 설치/빌드는 통과했다.
- Node strip의 TS parameter property 오류는 명시적 필드로 수정했다. 새 lint 경고는 제거했으며 기존 postcss 경고1만 남았다.
- finalize ACK 손실 뒤 ready 사진 정리 경쟁은 atomic abort claim으로 막았다. 실패 제거가 불확실하면 tracking 행을 유지한다.

## 다음 실행할 작업

1. 후속 문서 commit의 배포 상태와 .verification/board-features-validation.json 최신 결과를 확인한다. 이미 적용한 migration은 다시 실행하지 않는다.
2. 독립 TEST 환경에서 PostgreSQL 동시성·실제 Storage E2E를 검증한다. 현재 운영 회원/게시글/투표를 테스트용으로 변경하지 않는다.
3. 운영 HTTP 접근 도구가 복구되면 비로그인 차단과 로그인 후 업로드를 확인하고 READY와 실제 E2E 결과를 구분해 기록한다.
4. 기존 콘텐츠/UUID/권한과 개인 사진 비공개를 보존한다. 저장소는 Public 상태이며 설정·과금·도메인을 변경하지 않았다.

## 테스트 결과

- npm test68/68(기존64+실제 코덱3+cleanup guard1), 실패/skip0.
- typecheck 통과, lint 오류0/기존 경고1, check:conflicts/check:presentations와 Production Build 통과.
- test:integration 합성 HTTP 통과. test:browser 실제 Chrome39항목,390/768/1440px 사진/좋아요/실패 재시도/기존 화면 통과.
- test:production 로컬 production build/start+합성 DB/Storage 통과. 실제 PostgreSQL/Storage 쓰기와 구분한다.
- 실제 운영 DB 신규 DDL/RLS/권한/읽기 RPC 및 기존8테이블 지문 보존 검증 통과. 운영 테스트 데이터/파일 생성0.
- Vercel 기능 Preview/Production READY, 운영 도메인 연결 확인. 실제 HTTP/E2E는 위 접근 제한으로 미검증.
- QA 산출물은 .verification/member-browser/report.json, board-likes-images-*.png, member-auth-report.json, board-features-validation.json이다. 비밀 값과 실제 콘텐츠는 기록하지 않는다.
