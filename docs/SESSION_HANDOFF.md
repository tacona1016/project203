# 세션 인계

2026-11-03. 비밀번호·키·쿠키·실제 회원/사진/개인정보는 기록하지 않는다. 재개 시 이 문서와 .verification/board-features-baseline.json 및 현재 diff를 먼저 대조한다.

## 최신 승인 및 운영 반영 진행

- 사용자가 일반 개발·GitHub push·비파괴 migration·Vercel 배포를 사전 승인했다. `docs/DEVELOPMENT_AUTHORIZATION.md`와 AGENTS.md에 반영했다. 파괴적 작업·RLS 완화·과금 변경은 제외다.
- 원격 main/Production은03118e2 READY로 재확인했다. 소스 충돌은 없고 다른 코드 변경은 없었다. 루트 .git 제한과 이전 작업은 보존하고 GitHub 연결 도구로 현재 원격 tree 기반 commit을 준비한다.
- 신규 migration `20261103143211_board_likes_images`, `20261103143219_board_attachments_bucket` 적용 완료. 새 테이블3개/RPC10개·Private 버킷3MiB/WebP 전용. 과거 migration·기존 댓글 수정 RPC는 재실행하지 않았다.
- 운영 DB 권한/RLS/조회 RPC 실제 검증과 Security Advisor 경고0 확인. 기존 데이터 지문을 적용 전 보관했다. 새 테이블은 모두0행이며 실제 회원/테스트 글/사진을 생성하지 않았다.
- 로컬의 Storage 및 기존 DB HTTP 호출은 모두 network/fetch 단계 실패. 잘못된 비밀번호나 키로 판단하지 않는다. Vercel은 기존 Production 환경변수 이름·대상만 확인했고 값을 읽거나 변경하지 않았다. Preview에는 기존 서버 환경변수가 없으므로 인증 기능을 검증했다고 보고하지 않는다.
- 다음 작업: 최종 코드/문서 검사 → 최신 원격 parent로 기능 commit → main fast-forward → 새 Production READY 및 비로그인 접근 차단 검증 → 데이터 지문/결과 문서 갱신. 실제 TEST PostgreSQL 동시성·실제 회원 업로드는 아직 미검증이다.

아래는 최초 로컬 구현 완료 시점의 기록이며 승인 대기 문구보다 위 최신 상태를 우선한다.

## 현재 개발 목표

BOARD 기존 수정 검증, 게시글/댓글 좋아요, 비공개 게시글 사진 최대3장 구현과 로컬 검증을 완료했다. 운영 DB/Storage 생성·변경, GitHub push 및 Preview/Production 배포는 이번 요청의 별도 승인 대상이다. 이번 작업에서 실행하지 않는다. 기존 인증·투표·MDX·데이터 보존 우선.

## 완료한 작업

- 시작 상태: root의 fix/rebase-integrity/e46d233와 이전 복구 미커밋 변경을 보존했다. .git 쓰기 제한으로 fetch 불가. 연결 도구로 실제 원격/Production03118e2 READY를 확인했다. rebase·index 충돌·소스 마커 없음.
- 시작231파일 hash와 이전 인계는 .verification/board-features-baseline.json, .verification/board-handoff-before.md에 보존했다. root refs는 바꾸지 않았다. 별도 로컬 검토 repo .verification/board-feature-branch의 feat/board-likes-images에 현재 코드 체크포인트를 만들고 최종 변경을 저장한다. 원래 코드/커밋/미커밋 변경을 초기화하지 않았다.
- 운영 읽기 확인: edit_board_comment 존재, SECURITY INVOKER, anon 실행 차단/server 실행 허용. 재생성하지 않았다. Storage버킷0·새 좋아요/사진테이블 없음·Free 플랜. SQL bucket INSERT 권한과 Storage RLS도 확인했으나 실제 버킷 생성은 미실행.
- 기존 게시글/댓글 수정 UI/RPC를 재사용하고 사진 부분 실패시 본문 저장 여부와 편집 잠금을 보완했다. 기존 관계·공지·권한 유지.
- 좋아요: 게시글/댓글 복합PK, 서버 세션/RPC, 멱등 PUT/DELETE, 낙관 UI·실패 복원·실제 상태 재조회, 댓글 페이지당 일괄 조회. UUID 명단은 반환하지 않는다.
- 사진:3MiB 개별 raw 업로드, 실제 포맷/픽셀 검증, Sharp0.35.5 WebP 재인코딩·EXIF 제거, Private bucket 확인, 인증된 no-store 이미지 GET, 작성자만 관리. 최대3슬롯·회원75MiB/전체750MiB, UUID 멱등 키·해시·작업 lease·추적 상태로 실패/중단을 복구한다.
- 사진 picker/미리보기/삭제 취소/파일별 재시도·갤러리·확대/ESC, 기존 draft에 이미지 미저장, 본문 저장 ACK 후 사진 처리·재시도시 글 중복 생성 방지를 구현했다.
- SQL/Storage 제안과 TEST SQL·기본 dry-run 정리 스크립트, docs/BOARD_LIKES_IMAGES_IMPLEMENTATION.md 작성. 운영 SQL·Storage·정리 실행·배포 없음.
- React 체크리스트와 최종 diff 검토. 기존 인증/투표/발표/기존 migration44파일 시작 해시 보존, 삭제0개.
- 중단 후 최종 대조: 이번 작업 수정15개·추가23개, 총38개만 검토 저장소에 반영했다. 충돌/공백/문서 링크 검사 통과. 검증 기록은 .verification/board-features-validation.json에 보관한다. 기존 root의 복구 작업과 이번 변경을 구분했다.

## 수정한 파일

정확한 시작 대비 목록은 .verification/board-features-changed-files.json과 보고서9절을 참조한다.
- 기존 연결: app/board/[id]/page.tsx, globals.css, BoardEditor/BoardComments, lib/board/data/types, Supabase types.
- 새 UI: BoardLikeButton/BoardImagePicker/BoardImageGallery, image-client.
- 새 서버/API: engagement/feature-http/image-policy/image-codec/image-data, 게시글·댓글 like 및 images routes.
- 새 SQL: supabase/proposals/board_likes_images.sql, board_attachments_bucket.sql, supabase/tests/board_likes_images.sql.
- Sharp를 기존 잠금 버전0.35.5 직접 의존성으로 승격한 package/lock. 실행 가능/npm ls dedupe 확인.
- 정리 script, codec/maintenance 단위, Board fixture 및 새 HTTP/Chrome 회귀, README/Board 운영 문서/이 보고서/인계.

## 미완료 및 승인 대기

- 별도 TEST PostgreSQL에서 제안 SQL 실행·실제 두 연결 잠금/동시성·RLS 검증. 로컬 PG/CLI가 없어 실행하지 않았다. 합성 HTTP 검사와 구분한다.
- 실제 Storage 버킷 생성/업로드·삭제, Preview와 Linux fresh npm ci, 운영 회원 E2E·Safari 실기기. 새 다운로드는 offline 캐시 제한으로 미검증이다. 설치된 동일 Sharp와 기존 lock 정보를 사용해 구현/빌드했다.
- 운영 SQL·Private bucket·정리·Production 배포/main push. 승인 전에는 수행하지 않는다. 기존 migration/schema/seed 재실행 금지, 댓글 수정 RPC 재생성 금지.
- HEIC/AVIF·댓글 사진·자동 정리/cron은 미구현 범위다.

## 발생한 오류와 처리

- 원본 .git 쓰기 및 clone 소유권 제한: 원본은 보존하고 별도 로컬 repo의 검토브랜치 사용. 체크포인트에 빠졌던 .env.example/장식사진 placeholder는 즉시 후속 커밋으로 복원했다. root 파일은 건드리지 않았다.
- npm offline/cache 권한·패키지 캐시 부재: 과도한 재시도 중단. 이미 실행 가능한 Sharp를 직접 선언하고 lock의 필수 의존성 optional 표시를 정리했다. 새 패키지 다운로드/CI 설치를 성공으로 보고하지 않는다.
- 새 Codec의 TS parameter property를 Node strip 모드가 거부: 명시적 status 필드로 고쳐 실제 코덱3개 통과.
- 새 lint 경고2개는 if문으로 정리했다. 기존 postcss 경고1만 남았다.
- ready finalize ACK 손실 뒤 정리 경쟁은 atomic abort claim으로 막았다. pending/deleting이 남으면 동일 UUID는2분 뒤 재개하며24시간 이상 중단은 승인된 정리 대상으로 남긴다. 정상 ready 사진은 늦은 abort/cleanup으로 제거하지 않는다.

## 다음 실행할 작업

1. 필수 로컬 구현·검사는 완료 상태다. 보고서와 정확한 SQL/Storage 승인 대기 항목을 사용자에게 안내한다.
2. 승인 후 별도 TEST DB/Storage 검증 → 새 제안 SQL만 적용 → Private bucket/정책/파일제한 확인 → Preview → 별도 Production 승인 순서로 진행한다.
3. 코드 재개 시 이미 통과한 구현을 반복하지 말고 최종 로컬 검토브랜치/manifest와 실제 diff를 먼저 비교한다.

## 테스트 결과

- npm test:68/68, 실패0/skip0 (기존64+Codec3+정리 가드1).
- npm run typecheck:통과. npm run lint:오류0/기존경고1.
- npm run build:conflict/publication/MDX 검사와 Next16.4.2 production compile 통과.
- npm run test:integration:합성 HTTP API 통과. 최종 확장 API는 browser/production 실행에도 포함.
- npm run test:browser:최종통과, Chrome39항목. 사진 선택·부분 실패/재시도·글1개 보존·좋아요/댓글편집·사진교체·확대/ESC·390/768/1440 overflow 포함.
- npm run test:production:최종통과. 로컬 production build/start+합성 Storage/DB API이며 운영 Vercel 테스트가 아니다.
- 실제 운영 데이터를 이용한 테스트·SQL 적용은 없음. SQL/Storage 실환경·새 설치·Safari는 위 미검증 항목과 구분한다.
- QA 산출물은 Git 제외 .verification/member-browser/report.json, board-likes-images-*.png, member-auth-report.json, board-features-validation.json에 기록한다.
