# 데이터 백업과 복구

확인일: **2026-11-11**. 아래 최신 절차를 우선한다. 실제 운영 백업·외부 저장소·스케줄·복원은 활성화하지 않았다. 백업 파일과 인증 정보는 Git에 넣지 않는다.

## 최신 상태와 구현 범위

| 상태 | 확인 결과 |
| --- | --- |
| 운영 읽기 전용 확인 | public 앱 11테이블 모두 RLS. `board-attachments` Private/3MiB 제한, 객체 1개. 행·사진 원문 조회/변경 없음. |
| 현재 백업 대상 | participants, polls, poll_options, votes, **poll_choice_selections**, comments, board_posts, board_post_comments, board_post_likes, board_comment_likes, board_post_images. 신규 프로젝트 관리 SQL 적용 후 project_admin_entries/project_admin_revisions도 자동 포함. |
| 플랜 | 조직 Free 확인. 자동 백업 보유·최근 성공·PITR는 확인하지 못했다. |
| 코드 | Node 내장 AES-256-GCM 암호화, public custom pg_dump, Storage 객체 다운로드, 해시/인증 태그 검증, 안전한 TEST 복원 가드, 수동 workflow 구현. |
| 실제 실행 | 합성 데이터 암호화·변조 탐지 단위 테스트만 완료. pg_dump/psql/pg_restore/Docker가 로컬 PATH에 없고 저장소·키·TEST가 준비되지 않아 실제 운영 백업/복원은 미실행. |
| 운영 활성화 | **승인 대기**. 신규 Secret·Object Storage·요금·예약 실행을 변경하지 않았다. |

DB dump는 객체 본문을 포함하지 않는다. 현재 스크립트는 **DB와 Storage 파일을 따로 암호화**한다. `public` 스키마의 테이블·데이터·FK/CHECK·RPC/함수·트리거·인덱스·RLS·GRANT·sequence 정의/값을 custom archive에 포함한다. Storage bucket 설정·경로·메타데이터와 ready 이미지 해시는 암호화 manifest에 넣는다. Supabase managed auth/storage 스키마 전체나 역할 비밀번호를 덤프/덮어쓰지 않는다. 사이트 로그인 매핑·Vercel Secret·Git의 발표자료/장식용 사진은 별도 관리 대상이다. [공식 백업 범위](https://supabase.com/docs/guides/platform/backups)

## 암호화 백업 실행

`scripts/project-backup.mjs`는 **기본 실행이 도움말**이다. 설정은 프로세스에만 주입하고 콘솔/공개 workflow 입력에 Secret을 넣지 않는다. 예시 파일의 값은 실제 인증 정보가 아니다.

| 설정 | 용도 |
| --- | --- |
| `PROJECT203_BACKUP_CONFIRMED=READ_ONLY_SOURCE` | 원본 읽기 확인 |
| `BACKUP_SOURCE_REF`, `BACKUP_SOURCE_URL`, `BACKUP_SOURCE_KEY` | 원본 ref·정확히 대응하는 URL·서버 키 |
| `BACKUP_DB_HOST`, `BACKUP_DB_USER`, `BACKUP_DB_PASSWORD` | 원본 direct DB 연결; port 기본5432/name postgres/SSL require |
| `BACKUP_ENCRYPTION_KEY` | 별도 생성·별도 보관한 32bytes 키의 64자리 hex. 앱 세션 키와 혼용 금지 |
| `BACKUP_GIT_SHA` | 로컬 백업 시 해당 코드 SHA; Actions에서는 GITHUB_SHA 사용 |
| `PROJECT203_PG_CONTAINER=postgres:17` | 선택: 설치된 Docker에서 공식 PG17 도구 실행. 비밀번호는 argv가 아닌 환경으로 전달 |

```powershell
node scripts/project-backup.mjs check
node scripts/project-backup.mjs create
node scripts/project-backup.mjs verify backups/<생성된-백업-ID>
```

원본 연결은 read-only transaction/statement timeout을 사용한다. export한 동일 snapshot으로 DB dump와 행 개수·권한 inventory를 읽는다. Storage는 별도 서비스이므로 완전한 전역 snapshot은 아니다. 객체 수집 당시 크기/ETag 및 ready 이미지 SHA 불일치는 실패 처리한다. 백업 중 사진 삭제·업로드나 스키마 변경을 피하고 불일치하면 새 백업을 수행한다. 데이터 손상 복구를 위해 원본 UPDATE/DELETE는 하지 않는다.

저장 경로는 Git ignore된 `backups/<ID>/`. SQL·사진은 메모리/스트림에서 즉시 암호화되고 평문 파일로 남기지 않는다. `manifest.enc`에는 실행 시각·Git SHA·각 파일 SHA256·행 개수·객체 경로/메타데이터가 있다. `receipt.json`은 개인정보 없이 성공/실패·단계·개수·manifest 해시를 기록한다. 실패하면 부분 암호화 파일을 보존하고 성공으로 표시하지 않는다. 권한 0600/0700은 POSIX 기준이며 Windows에서는 소유자만 읽는 ACL/암호화 디스크도 확인한다.

## 비공개 외부 보관과 수동 workflow

현재 구현한 업로드 대상은 **AWS S3 API**다. 다른 S3 호환 서비스를 검증한 것으로 간주하지 않는다. 원본 Supabase와 다른 승인된 비공개 bucket/prefix를 사용한다. bucket 생성·정책 변경은 자동 실행하지 않는다.

- `BACKUP_DESTINATION_CONFIRMED=PRIVATE_APPROVED`, `BACKUP_S3_BUCKET`, `BACKUP_S3_PREFIX=project203-backups/<운영용-접미사>` 및 제한된 AWS 자격증명을 준비한다.
- S3 Public Access Block 네 항목 true, bucket policy status IsPublic=false를 확인하지 못하면 업로드를 거부한다. bucket policy가 없어 조회가 실패해도 자동으로 공개 범위를 바꾸지 않는다. 운영자가 IAM/정책 확인 후 준비한다.
- IAM은 해당 prefix PUT/HEAD와 공개 차단 설정 조회에 필요한 권한만 부여한다. 파일 업로드 후 서버 SHA256 checksum/길이까지 확인한다. 보관 위치·region·요금은 선택되지 않았으므로 실제 월 비용은 미확정이다. [AWS 비용 항목](https://aws.amazon.com/s3/pricing/)
- `node scripts/project-backup.mjs create --upload`는 이 조건을 충족한 뒤에만 실행한다.
- `.github/workflows/backup-manual.yml`: `workflow_dispatch`만 존재한다. main + `PROJECT203_BACKUP_READY=true` + `production-backup` environment가 모두 필요하다. 기본 비활성. **environment에 필수 승인자/브랜치 제한을 먼저 설정**한 뒤 Secret을 등록한다. 임의 PR 코드에 운영 Secret을 제공하지 않는다.
- 공개 Actions artifact 업로드·commit·cron·자동 삭제·복원 step은 없다. 실패 exit/단계 코드만 로그로 남긴다. 수동 실행 성공 후 알림과 예약 실행은 별도 승인한다.

권장 주기는 매주 DB+Storage 1세트, 중요 변경 직전 수동 추가, 주간4본+월간12본이다. `retention <비공개-receipts.json>`은 주/월별 최신 성공본을 고르는 **삭제 없는 계획**만 출력한다. 동일 백업이 두 보존 조건을 만족하면 한 번 보관한다. 실제 remote 정리·lifecycle·주간 cron은 복원 연습 뒤 별도 활성화한다.

Free는 정기 off-site export가 권장되고, Pro는 일일 백업 최근7일을 제공한다. Free Storage1GB/egress5GB 기본 한도는 계정·청구기간별 사용량을 함께 확인한다. 백업 다운로드도 egress를 사용하며 유료화가 자동 승인된 것은 아니다. [Supabase 백업](https://supabase.com/docs/guides/platform/backups), [사용량/플랜](https://supabase.com/docs/guides/platform/billing-on-supabase)

## 독립 TEST 복원 검증

운영 복원 기능은 제공하지 않는다. TEST ref가 운영과 다르고 URL/direct DB host가 그 TEST ref와 정확히 대응해야 한다. `RESTORE_TEST_CONFIRM=ISOLATED_TEST_ONLY`와 CLI 확인 플래그를 모두 요구한다. TEST public 테이블/Storage가 비어 있지 않으면 중단한다. 기존 TEST를 DROP/TRUNCATE로 비우지 않는다.

1. 승인된 별도 빈 TEST Supabase(PG17 호환)에 원본과 동일한 이름/제한의 **비공개 bucket만 미리 준비**한다. 원본과 다른 API 키와 DB 자격증명을 사용한다.
2. `RESTORE_TEST_REF`, `RESTORE_TEST_URL`, `RESTORE_TEST_KEY`, `RESTORE_TEST_DB_HOST/USER/PASSWORD`, `RESTORE_TEST_CONFIRM`을 프로세스에 설정한다. 백업 키는 별도 안전한 장소에서 가져온다.
3. `node scripts/project-backup.mjs verify backups/<ID>`로 AES 인증 태그·암호문/평문 SHA·크기를 먼저 확인한다.
4. `node scripts/project-backup.mjs restore-test backups/<ID> --confirm-test-restore`를 실행한다. pg_restore는 public schema 재생성 항목만 제외하고 단일 transaction/exit-on-error/no-owner로 복원한다. `--clean`, reset, DROP은 사용하지 않는다.
5. 행 개수·RLS·anon/authenticated의 테이블/컬럼/함수/sequence 권한을 원본 manifest와 대조한다. Storage 객체는 TEST에 no-upsert 업로드 후 다시 다운로드해 SHA/개수를 확인한다. 실제 회원 E2E는 [독립 TEST 절차](ISOLATED_TEST_ENVIRONMENT.md)로 추가 수행한다.
6. 스크립트 성공은 해당 dump/객체의 검사 성공이다. 트리거·인덱스·sequence 다음 값·모든 앱 동작의 의미적 복구까지 보증하려면 TEST SQL/E2E와 운영자 검토가 필요하다. 신규 DB 스키마와 원본 snapshot의 동시성·허용 확장도 확인한다.

현재 **백업 코드 구현 / 수동 workflow 코드 준비** 상태다. **자동 실행 설정, 실제 암호화 운영 백업, 원격 보관, TEST 복원은 미완료**다. 승인 없이 설정하지 않는다.

## 데이터 손실 시 대응

추가 쓰기를 멈추고 원본 증거 보존 → 백업 시각/손실 구간 비교 → 별도 TEST에서 복원·권한·앱 검증 → 운영 중단 시간/덮어쓰기 위험/롤백 계획 제시 → **운영 복원 별도 승인** → 승인 범위만 실행 → 새 백업·사건 기록. 백업이 있다는 이유로 즉시 운영 복원이나 기존 migration 재실행을 하지 않는다.

---

아래는 **2026-10-31~11-01 당시의 역사 기록**이다. 테이블7/8개·Storage0개·플랜 미확인은 현재 상태가 아니다. 옛 CLI/복원 예시는 현재 실행 지시가 아니며 위 스크립트·TEST 절차를 우선한다.

## 1. 확인 범위

| 구분 | 확인한 내용 |
| --- | --- |
| 코드에서 확인 | 앱 테이블 7개, SQL migration·권한 검사 SQL, 서버 전용 Supabase 접근. 앱의 Supabase Storage 사용 코드는 없으며 사진은 `private-assets/site/`에 보관한다. |
| 운영 읽기 전용 검사 | Supabase 상태 ACTIVE_HEALTHY, PostgreSQL 17.11.0.003. public의 7개 앱 테이블은 RLS가 켜져 있고 anon SELECT/INSERT 및 authenticated SELECT가 차단되어 있다. Storage buckets/objects는 각각 0개였다. |
| 추가 권한 검사 | 위 테이블의 모든 컬럼에서 anon SELECT가 차단되어 있고, 점검한 앱 RPC 12개는 anon/authenticated EXECUTE가 차단되고 service_role EXECUTE가 허용되어 있었다. 모든 DB 함수 전수 검사라는 뜻은 아니다. |
| 운영 migration 목록 | 조회 결과가 빈 배열이었다. 테이블은 존재하므로 SQL Editor로 수동 적용했을 수 있다. **미적용으로 단정하거나 과거 SQL을 일괄 재실행하지 않는다.** |
| 미확인 | 실제 요금 플랜, 일일 백업 보유/성공 여부, PITR 활성화, 백업 다운로드와 복구 성공 여부. 프로젝트 조회 응답에 이 정보가 없어 추정하지 않았다. |
| 로컬 실행 한계 | 현재 PATH에서 Supabase CLI·Docker·psql·pg_dump·pg_restore가 확인되지 않았다. 아래 명령은 공식 문서와 대조했지만 실제 백업·복원은 실행하지 않았다. |

## 2. 백업 대상

| 대상 | 포함해야 할 것 |
| --- | --- |
| `participants` | UUID, 이름, 활성 상태와 표시 순서. 기존 UUID를 유지한다. |
| `polls`, `poll_options`, `votes` | 질문·유형·분기·상태·공개 정책·선택지·객관식 표·주관식 응답과 시각. |
| `poll_choice_selections` (복수선택 migration 적용 후) | 객관식의 현재 선택·취소 상태와 시각. 원본 votes만으로 신규 응답을 복원할 수 없으므로 반드시 함께 백업한다. |
| `comments` | 분기 발표 댓글과 작성자 관계. |
| `board_posts`, `board_post_comments` | 일반 글·공지·고정·본문·작성자·시각 및 soft delete된 기록도 포함. |
| DB 정의 | 스키마, FK/CHECK/인덱스, 함수/RPC, 트리거, RLS 정책, 테이블·컬럼·시퀀스·함수 grants, identity/sequence 상태. |
| 코드·발표자료 | Git 이력, `supabase/` SQL, `data/`, MDX와 공개 자산. Git 백업은 DB 행을 대신하지 않는다. |
| 사진·운영 설정 | 개인 사진은 별도 암호화 보관. 환경변수·DB 접속 정보는 별도 비밀 관리 도구에 보관하고 백업 설명서나 Git에 쓰지 않는다. |

이 사이트의 개인 로그인 비밀번호 매핑과 세션 서명 키는 DB가 아닌 서버 환경변수다. DB 복원만으로 Vercel 설정이나 로그인 환경이 복구되지 않는다. 현재 Storage는 비어 있지만 향후 사용하면 실제 객체도 따로 보관해야 한다. DB 백업에는 Storage 파일 본문이 들어가지 않는다. [Supabase 백업 범위](https://supabase.com/docs/guides/platform/backups)

## 3. 자동 백업과 플랜

공식 문서 확인 기준으로 Pro·Team·Enterprise는 일일 백업을 제공하며 접근 가능한 보존 기간은 각각 최근 7·14·최대 30일이다. Free는 CLI로 정기 export하여 별도 장소에 보관하도록 권장한다. PITR는 유료 플랜의 추가 기능이며 최소 Small compute가 필요하다. 실제 제공 범위·요금은 설정 시 Dashboard에서 다시 확인한다. 이 프로젝트의 실제 플랜이나 백업 활성화 상태를 확인한 것은 아니다. [공식 백업·PITR 안내](https://supabase.com/docs/guides/platform/backups)

권장 초기 운영 주기는 **주 1회 수동 백업**, 중요한 투표 마감·결정 공지 등록 직후 추가 백업, DB migration·대량 변경 직전 백업이다. 주간본 4개와 월간본 12개를 기본으로 두고, 분기 확정 기록은 별도 장기 보관한다. 이는 제안이며 자동 스케줄을 설정한 상태가 아니다.

## 4. 안전한 수동 백업

### 준비

- 운영자가 Dashboard의 프로젝트·접속 대상을 확인한다. API Secret Key는 PostgreSQL 접속 비밀번호가 아니다.
- Supabase CLI와 Docker를 설치하고 `supabase --version`, `supabase db dump --help`로 현재 명령을 확인한다. CLI dump는 Docker 안의 pg_dump와 Supabase용 필터를 사용한다.
- 원본 저장소 밖의 접근 제한된 암호화 폴더를 사용한다. CLI 작업 폴더와 dump 폴더도 구분한다.
- 비밀번호를 명령 문자열·스크린샷·터미널 기록에 적지 않는다. CLI의 대화형 인증/비밀번호 입력을 사용하고 `--debug`를 켜지 않는다. 실제 접속 정보를 넣은 `--dry-run`도 실행 스크립트를 출력할 수 있으므로 공유 로그에 사용하지 않는다.
- 백업 중 스키마 변경을 피한다. 세 dump는 별도 명령이므로 공통 시점의 물리 백업과 같다고 간주하지 않는다.

### 명령 예시 — 운영자가 직접 실행

아래 폴더는 저장소 밖에 만들며 실제 프로젝트 ID는 Dashboard에서 확인해 입력한다. `supabase init`과 `link`는 이 전용 작업 폴더에서만 실행한다. `db push`, `db reset`, seed는 백업 절차에 포함하지 않는다.

```powershell
$taskBackupRoot = Join-Path $env:USERPROFILE "203-project-backups"
$taskBackupWork = Join-Path $taskBackupRoot "cli-work"
$taskBackupRun = Join-Path $taskBackupRoot (Get-Date -Format "yyyyMMdd-HHmmss")
New-Item -ItemType Directory -Force -Path $taskBackupWork, $taskBackupRun | Out-Null
Push-Location -LiteralPath $taskBackupWork

# 최초 한 번만 초기화/연결한다. 인증 정보는 대화형으로 입력한다.
supabase init
supabase login
supabase link --project-ref "<DASHBOARD에서_확인한_원본_PROJECT_REF>"

supabase db dump --linked --role-only --file (Join-Path $taskBackupRun "roles.sql")
if ($LASTEXITCODE -ne 0) { throw "역할 백업 실패: 비밀값 없이 원인을 확인하세요." }
supabase db dump --linked --schema public --file (Join-Path $taskBackupRun "schema.sql")
if ($LASTEXITCODE -ne 0) { throw "스키마 백업 실패: 비밀값 없이 원인을 확인하세요." }
supabase db dump --linked --schema public --data-only --use-copy --file (Join-Path $taskBackupRun "data.sql")
if ($LASTEXITCODE -ne 0) { throw "데이터 백업 실패: 비밀값 없이 원인을 확인하세요." }

Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $taskBackupRun "roles.sql"), (Join-Path $taskBackupRun "schema.sql"), (Join-Path $taskBackupRun "data.sql")
Pop-Location
```

`<...>`는 실제 값으로 교체할 표시이며 그대로 실행할 명령이 아니다. CLI 인증·프로젝트 연결이 이미 완료되었다면 초기화/로그인/연결은 반복하지 않는다. public 범위는 이 앱의 백업이며 전체 Supabase managed 서비스의 완전한 복제는 아니다. 사용자 정의 역할, 데이터, 스키마는 따로 dump해야 한다. CSV나 data-only 파일 하나만으로 RLS·RPC까지 복원할 수 없다. [공식 CLI dump](https://supabase.com/docs/reference/cli/supabase-db-dump), [공식 백업·복원 순서](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)

### 파일 보관

1. 세 파일이 존재하고 비어 있지 않은지, CLI가 성공했는지 확인한다. 성공 종료만으로 복구 가능성을 보장하지 않으므로 복구 연습이 필요하다.
2. 백업 일시·원본 프로젝트 참조·Git commit·CLI/DB 버전·파일 해시와 **개인정보 없는 행 개수**를 기록한다. 비밀번호·키·실제 본문은 기록하지 않는다.
3. 백업 파일을 암호화하고 접근자를 제한한다. 암호화 암호/복구 키는 파일과 다른 안전한 장소에 보관한다.
4. 암호화된 사본을 장비와 다른 비공개 장소에 하나 더 보관한다. 공개 GitHub·PR 첨부·메신저 공개 채널에 올리지 않는다. 단순 ZIP 압축은 암호화가 아니다.
5. 보존 기간에 따른 정리는 복구 가능한 다른 사본이 있음을 확인한 뒤 운영자가 수행한다. 이 문서는 파일 삭제나 외부 동기화를 자동 실행하지 않는다.

## 5. TEST 환경 복구 연습

**운영 DB에서는 실행하지 않는다.** 운영 데이터가 포함된 백업은 승인된 비공개 TEST 환경에서만 다룬다. 원본과 다른 신규 프로젝트, 접근자, 비용, 보관·폐기 계획을 먼저 확인한다. 기존 데이터가 있는 DB에 덮어쓰거나 `--clean`·DROP·TRUNCATE·원격 reset으로 비우지 않는다.

1. 별도 Supabase TEST 프로젝트를 준비한다. source와 target의 프로젝트 참조/호스트가 다름을 두 번 확인한다.
2. 원본과 호환되는 PostgreSQL 버전·확장 기능을 준비한다. 기본 관리 역할은 신규 Supabase 프로젝트가 제공한다. 사용자 정의 역할 비밀번호·환경변수·API 키·사진은 별도로 재설정/복구한다.
3. psql을 설치하고 `psql --version`, `psql --help`를 확인한다. target 정보만 아래 환경변수에 넣고 DB 비밀번호는 `--password`의 대화형 입력을 이용한다.
4. **새 TEST DB**에서 대상 기본 권한을 회수한 뒤 역할 → 스키마 → 데이터 순서로 복원한다. 대상 DB의 기본 grants가 원본의 비공개 정책을 다시 열지 않도록 한다.

```powershell
$taskBackupRun = "<검증할 백업 폴더의 절대 경로>"
$env:PGHOST = "<TEST 프로젝트의 Direct 또는 Session pooler host>"
$env:PGPORT = "5432"
$env:PGUSER = "<TEST Connect 화면의 user>"
$env:PGDATABASE = "postgres"
$env:PGSSLMODE = "require"

psql --password --single-transaction --variable ON_ERROR_STOP=1 `
  --command "ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;" `
  --file (Join-Path $taskBackupRun "roles.sql") `
  --file (Join-Path $taskBackupRun "schema.sql") `
  --command "SET session_replication_role = replica;" `
  --file (Join-Path $taskBackupRun "data.sql") `
  --command "SET session_replication_role = origin;"
if ($LASTEXITCODE -ne 0) { throw "TEST 복원 실패: 운영으로 전환하지 마세요." }
```

이 명령은 schema·data의 트리거 간섭을 피하기 위한 공식 복원 순서를 따른다. 트리거 비활성화는 이 복원 연결의 transaction에만 적용하고, 오류가 나면 중단·rollback한다. 기본 권한 회수는 기존 테이블의 grants까지 자동 회수하는 명령이 아니므로 다음 검사가 반드시 필요하다. [권한 복원 주의사항](https://supabase.com/docs/reference/cli/supabase-db-dump)

### 복구 확인표

- 확인 당시 7개 앱 테이블과 FK/CHECK/인덱스, 모든 RPC·트리거, RLS 정책과 grants가 존재하는지 확인한다. 복수선택 migration 이후에는 `poll_choice_selections`까지 총 8개이며, 새 제출/참여 RPC와 UNIQUE·복합 FK도 포함한다.
- 각 테이블 행 개수, participant UUID 관계, 선택지/투표 관계, soft delete 기록, identity/sequence의 다음 값이 복구됐는지 확인한다. 실제 개인정보를 보고서에 출력하지 않는다.
- anon/authenticated의 테이블 **및 컬럼**, 시퀀스, 함수 직접 접근이 원본처럼 차단되는지 확인한다. RLS 활성 여부만 확인하고 끝내지 않는다.
- TEST 전용 환경변수로 앱을 연결하고 로그인·관리자·비공개 결과·투표/주관식·발표 댓글·게시판·공지·사진 접근을 검사한다. 새 키나 서명 키를 쓰면 재로그인이 필요하다.
- `supabase/tests/private_site_access.sql`, `board.sql` 등 DB 회귀 SQL은 내용을 검토한 뒤 TEST에서만 실행한다. 운영에 fixture를 삽입하지 않는다.
- 복원한 DB에 기존 schema·seed·과거 migration을 다시 실행하지 않는다. 원격 migration 이력이 비어 있으면 수동 적용 목록과 스키마를 먼저 대조한다.
- 수행자·일시·백업 시점·검사 결과·복구 소요 시간을 비밀값 없이 남긴다. 분기별 한 번을 초기 복구 연습 주기로 제안한다.

## 6. 실제 데이터 손실 발생 시

1. 추가 변경을 멈추고 운영자가 영향 테이블과 최초 이상 시점을 확인한다. 원본 증거·현재 데이터도 가능한 한 보존한다.
2. 사용 가능한 일일/PITR/수동 백업의 시점과 유실될 변경 범위를 비교한다. 백업이 있다는 이유만으로 즉시 운영 복원을 누르지 않는다.
3. 별도 TEST 환경에서 선택한 백업을 복원하고 데이터·권한·앱을 검증한다.
4. 복원 대상·중단 시간·예상 유실 범위·되돌릴 방법을 사용자에게 제시하고 **운영 복원 승인을 받는다.** Supabase Dashboard 복원 중에는 프로젝트 접근이 중단될 수 있다.
5. 승인된 작업만 실행하고 앱 연결·회원/관리자 세션·RLS·기능을 다시 검사한다. 복구 직후 새 백업과 사건 기록을 남긴다.

현재 완료한 것은 코드·운영 메타데이터 점검과 절차 문서화다. 백업 생성, 암호화 보관, 자동화, 실제 TEST/운영 복원 성공을 검증한 상태는 아니다.


## 2026-11-01 UI/UX 점검 업데이트

- 이제 poll_choice_selections는 운영에 실제 적용된 8번째 앱 테이블이다. 원본 votes 45행·canonical 37행을 읽기 확인했다. 두 테이블은 신규 선택과 역사 기록 역할이 달라 반드시 함께 백업한다.
- 운영 migration 기록은 20261101071652/choice_ballots, 저장소 SQL은 20261101000000_choice_ballots.sql이다. 과거 수동 SQL과 기록 차이가 있으므로 db push·seed·과거 migration 일괄 재실행을 하지 않는다.
- 앱 8개 테이블 RLS·공개 읽기 차단과 Storage bucket/object 0개를 다시 확인했다. 이번 점검에서 데이터·권한·스케줄은 변경하지 않았다.
- 실제 요금 플랜·백업 보유/최근 성공·PITR·다운로드/TEST 복구는 여전히 미검증이다. 위 백업 명령의 실제 실행 성공이나 복구 가능성을 새로 검증한 것으로 해석하지 않는다.
- 자동화가 필요하면 운영자가 보관 위치·암호화·주기·실패 알림·비용을 검토한 뒤 별도 승인한다. 먼저 수동 백업 한 세트를 별도 TEST 프로젝트에 복구해 UUID/외래키/원본·canonical 결과/RPC/RLS와 회원·관리자 권한을 검사한다. 운영 복구·삭제는 실행하지 않는다.
