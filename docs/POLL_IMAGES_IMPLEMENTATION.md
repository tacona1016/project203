# 투표 질문·선택지 이미지

2026-11-17. 작업 브랜치 `feat/poll-images`. 기준 원격 main `a5e8f83fafa09016c3ef7b628cc93508d88c1de3`. 루트의 이전 브랜치·미커밋 문서는 보존하고 `.verification/board-feature-branch`에서 작업한다. Production은 기존 `dpl_ERVfvHXxZZkWwsdFkfU6PTn3QhQf` READY이며 이번 기능은 운영 미반영이다.

## 구현

| 항목 | 상태 / 동작 |
|---|---|
| 질문 이미지 | 구현 완료: 객관식·주관식 최대 3장, 복수 파일 선택, 교체·삭제·앞뒤 순서 변경 |
| 선택지 이미지 | 구현 완료: 실제 option_id별 최대 1장. 응답이 있어도 이미지 관리 가능 |
| 압축 | 로컬 검증 완료: 공통 Sharp 엔진, WebP 실제 bytes ≤500,000, 원본 ≤3MiB, 최대16MP·1920px |
| 보안 | 관리자 변경 API, 회원 bytes API, 숨김 투표 차단, private/no-store/nosniff, 서버 전용 Supabase |
| 확대 | 로컬 Chrome 검증 완료: native dialog, ESC·닫기·포커스 복귀·배경 스크롤 해제, 질문 사진 이전/다음 |
| 신규 투표 | 먼저 기존 API로 생성 → 실제 ID가 확정된 수정 화면으로 이동 → 사진 첨부. 생성 전 파일은 영구 업로드하지 않음 |
| 기존 투표 | 투표/선택지/응답 ID 보존. 이미지 없는 과거 투표·DB 미적용 환경도 기존 기능 사용 가능 |
| 실제 PostgreSQL/Storage | 미완료: 독립 TEST 프로젝트와 로컬 실행 도구 없음. 운영에 테스트 데이터 생성하지 않음 |
| 운영 SQL·Production | 승인 대기. 실행하지 않음 |

사진 관리는 투표 설정 저장과 별개로 즉시 저장한다. 선택지 문구·유형·순서 변경은 기존 응답 잠금 정책을 따른다. 응답이 없는 경우도 사진을 먼저 삭제한 후 선택지 설정을 저장하고 수정 화면을 다시 열게 안내한다. 기존 FK의 RESTRICT가 연결된 선택지의 삭제·재생성을 차단한다. 배열 index로 파일을 연결하지 않는다.

## 코드 구조와 변경 파일

- `lib/images/{codec,signature}.ts`: 기존 BOARD 코덱을 공통 엔진으로 추출. BOARD 함수 export와 정책은 유지한다. 한 번 디코딩·방향 보정·raw 픽셀 재사용, EXIF/GPS/XMP/ICC 제거, alpha 보존. 해상도 1920/1600/1280/1024/800, 품질 82/76/70/64/58/52/45, 최대35회·전체20초. 작은 원본 확대 없음.
- `lib/board/{image-codec,image-policy}.ts`: 공통 엔진 wrapper와 signature 재노출. 기존 이미지 조회의 legacy 3MiB 상한, Storage 경로·삭제·좋아요 로직은 변경하지 않는다.
- `lib/poll-images/{model,data}.ts`: 독립 정책, 공개 메타데이터, 기존 get_poll_detail 권한 확인 후 Storage 접근, 압축·예약·실제 저장 파일 크기/해시 재검증·확정·삭제·정리.
- `lib/supabase/{types,queries}.ts`: 투표 상세에만 ready 이미지 1배치 조회를 결합한다. 카탈로그/Home PollCard 조회는 늘리지 않는다. 누락된 스키마와 일시 장애를 구분하고 비공개 결과 null 정책은 유지한다. 경로·actor·token·SHA를 브라우저 메타데이터에 보내지 않는다.
- `app/api/admin/polls/[slug]/images/route.ts`: GET 목록, POST 바이너리 업로드, PATCH 질문 순서.
- `app/api/admin/polls/[slug]/images/[imageId]/route.ts`: DELETE. `images/cleanup/route.ts`: 명시적 관리자 정리.
- `app/api/polls/[slug]/images/[imageId]/route.ts`: 로그인 회원 GET/HEAD, ready·투표 소속·숨김·최종 SHA/크기 검증. 공개 URL/Signed URL/이미지 optimizer 사용 없음.
- `components/admin/{PollEditor,PollImageManager}.tsx`: 생성 후 수정 화면 진입, 독립 사진 관리, 용량/상태/재시도/삭제 확인/순서. 20개 선택지도 업로드 동시성은 1로 제한한다.
- `components/polls/PollImageGallery.tsx`, `components/interactive/{PollForm,PollResults}.tsx`, `app/admin/polls/[slug]/page.tsx`: 질문 갤러리, 선택지별 이미지, 득표순에서도 ID 매칭. 확대 버튼은 라디오/체크박스 label 밖에 두어 선택과 분리한다.
- `app/api/admin/polls/[slug]/route.ts`: 이미지가 연결된 선택지 변경에는 삭제·저장 순서를 안내하는 409 추가. 기존 DB 응답 보호는 유지한다.
- `app/globals.css`: poll-image 범위의 간결한 스타일만 추가. 기존 색상·Compact·MDX 보존.
- `tests/poll-images.test.mjs`, `tests/fixtures/poll-images.mjs`, `tests/integration/poll-images*.mjs`: 실제 Sharp·합성 API·실제 Chrome 검사.
- 기존 fixture/router와 browser harness는 새 검사 연결, 신규 투표의 의도된 `/edit` 이동 기대값만 갱신한다.
- `supabase/proposals/poll_images.sql`, `supabase/tests/poll_images.sql`: 신규 additive SQL 및 독립 TEST 트랜잭션 검증. 기존 migration 파일 변경/재실행 없음.

## DB와 Storage

신규 `poll_images`에 id/poll_id/option_id/path/type/bytes/dimensions/SHA/sort/state/token/replaces_id/actor/timestamps를 저장한다. `(poll_id,option_id)` 복합 FK는 운영에서 읽기 전용 확인한 기존 `poll_options_poll_id_id_key` unique index를 사용한다. 질문 slot0~2, 선택지 slot0 및 pending/ready 각각의 partial UNIQUE로 슬롯을 보호한다. 모든 이미지 변경은 parent poll FOR UPDATE로 직렬화한다. 교체 중에는 기존 ready + 새 pending이 잠시 공존하지만 표시되는 질문은 최대3, 선택지당1이다. ready 전환/이전 deleting 처리는 한 트랜잭션이다.

RLS 활성화, PUBLIC/anon/authenticated 테이블·RPC 권한 회수, service_role만 최소 권한. Supabase Auth의 auth.uid()를 프로젝트 회원 UUID로 간주하지 않는다. RPC는 SECURITY INVOKER이며 Next.js에서 기존 회원+추가 관리자 인증을 검증한다.

Private `poll-attachments` 버킷, 허용 image/webp·500000bytes. 경로는 `polls/{pollId}/questions/{UUID}.webp` 또는 `polls/{pollId}/options/{optionId}/{UUID}.webp`. 사용자 파일명은 저장 경로에 쓰지 않는다. 새 UUID 경로, upsert=false, 공개 정책 없음. 기존 `board-attachments` 변경 없음. [Supabase Storage 접근 제어](https://supabase.com/docs/guides/storage/security/access-control), [업로드 API](https://supabase.com/docs/reference/javascript/storage-from-upload)를 확인했다.

## 실패·재시도

1. 서버 압축 → pending 예약 → Storage 업로드 → 다운로드 SHA/실제 크기 확인 → ready 확정.
2. 같은 id/hash/target는 ready일 때 멱등 반환. pending은 120초 lease 이후 같은 파일/ID로 재시도한다. Storage 중복이면 덮어쓰지 않고 파일 검증 후 확정한다.
3. finish ACK가 사라지면 DB ready 재조회. 조회도 불확실하면 객체/행을 임의 삭제하지 않는다. 브라우저도 ready 목록에서 ID를 확인한 후 성공 판단한다.
4. 교체 실패 시 기존 ready를 유지한다. 성공 후 이전 파일은 deleting 기록을 남겨 삭제한다. 정리 실패가 새 ready를 되돌리지 않는다. replaces_id는 과거 객체 정리 후에도 멱등 키 검증용으로 남는다.
5. 삭제는 deleting → Storage 삭제 → token 일치 purge. 실패 시 기록 유지. 관리자 ‘중단된 업로드 정리’는 해당 투표에서 5분 이상 된 pending/deleting 최대5개만 처리한다. 자동 스케줄 없음. BOARD/다른 투표 파일은 대상이 아니다.

## 검증과 한계

- 초기 단위 **100/100 PASS**: 기존 95개 유지 + 공통 엔진/투명도/회전/메타데이터/형식·크기·픽셀/옵션 ID 매칭 검사 5개.
- 이미지 전용 합성 HTTP 8개 시나리오 묶음 PASS: 제한/권한/동시 제출/순서/교체/ACK/해시/정리/응답 보존/비공개/누락 DB/주관식. DB의 실제 동시성 검증은 아니다.
- Production-mode 실제 Chrome 4개 묶음 PASS: 320/390/430/768/1440 가로 넘침 없음, 확대와 선택 분리, ESC/focus/scroll, 실제 파일 입력→Next API→합성 Storage, 결과 정렬, DB 누락 시 관리 비활성화. 예외0/hydration0. 자료는 ignored `.verification/member-browser/poll-images-*`.
- typecheck PASS, lint 신규 오류·경고0(기존 postcss 경고1), production build PASS. 최종 추가 검증 결과는 아래 기록을 갱신한다.
- 운영은 스키마/인덱스/신규 테이블·버킷 부재만 읽기 전용 확인했다. 실제 PG SQL 실행·Storage 저장·운영 회원 E2E·Safari 실기기는 **미검증**이다. 독립 TEST 프로젝트 없이 다른 운영 프로젝트를 테스트용으로 사용하지 않았다.
- 초기 Chrome 파일 입력 테스트가 첫 빈 선택지를 선택해 실패했으나 data-option-id로 수정해 PASS. 전체 browser의 생성 후 상세 이동 기대는 새 명세의 수정 화면 이동으로 갱신했다. 기능을 삭제하거나 검사 비활성화하지 않았다.

## 적용 순서와 승인 경계

1. 신규 SQL은 **미적용 제안**이다. Supabase CLI/psql/docker가 없고 offline npm에도 CLI가 없어 임의 migration 파일명을 만들지 않았다. CLI가 있는 검토 환경에서 `supabase migration new poll_images` 후 생성된 파일에 제안 SQL을 넣고 변경 이력을 등록한다. 기존 migration 전체 db push 금지.
2. 별도 TEST DB/Private Storage와 가짜 회원으로 제안 SQL을 단독 적용하고 `supabase/tests/poll_images.sql`, 동시 4번째 질문/동일 옵션 업로드, 실제 Storage 실패·재시도·교체를 검증한다. SQL TEST는 rollback이며 운영 실행 금지.
3. TEST 전후 polls/options/votes/poll_choice_selections/comments 행 수·ID·집계 스냅샷을 비교한다. 테스트 계정만 사용한다.
4. 기능 브랜치 PR/CI/Preview에서 같은 SHA를 확인한다. Preview에 테스트용 환경변수가 없으면 회원 E2E를 성공으로 간주하지 않는다. Production Secret을 복사하지 않는다.
5. TEST 검증과 별도 승인 후 운영 SQL·Private 버킷을 한 번 적용한다. 기존 앱은 새 테이블을 사용하지 않으므로 호환된다. 환경변수 추가/변경은 필요 없다.
6. Production 배포는 별도 승인 후 수행한다. DB가 없는 신규 앱은 기존 투표를 유지하며 이미지 관리만 비활성화한다. 문제 시 이전 앱으로 되돌리고 새 private 테이블/객체는 보존한다. DB DROP/기존 사진 일괄 삭제·재압축으로 롤백하지 않는다.

GitHub PR/CI/Preview의 최종 URL·상태와 전체 검증 결과는 작업 종료 시 이 문서에 기록한다. main 병합·Production·운영 DB·환경변수·RLS/Storage 설정 변경은 이번 작업에 포함하지 않는다.

## 최종 로컬 검증 (2026-11-17)

| 명령/범위 | 결과 |
|---|---|
| npm run check:conflicts | PASS |
| npm run check:presentations | PASS |
| npm test | 100/100 PASS |
| npm run typecheck | PASS |
| npm run lint | 오류0·신규경고0·기존 postcss 경고1 |
| npm run build | PASS |
| npm run test:browser -- --production | 전체 합성 HTTP + 실제 Chrome45항목 PASS, 예외0/hydration0 |
| npm run test:integration -- --production --poll-images --browser | 이미지 HTTP8묶음 + 실제 Chrome4묶음 PASS, 5개 화면 폭, 예외0/hydration0 |
| npm run test:browser (개발 모드) | 최종 전체 HTTP24묶음 + Chrome45항목 PASS. 중간 1차 구 이동 기대값 수정, 2차 기존 404 hydration 안정성 검사 실패를 기록하며, 마지막 재실행과 Production 모드 동일 404 포함 전체 PASS |
| PostgreSQL/실제 Supabase Storage | 미실행, 독립 TEST 환경 없음 |
| 운영 회원 E2E | 미실행, 운영 테스트 데이터0 |

Preview 필수5변수는 현재도 Production에만 존재한다(이름·대상만 확인). 값 조회·복사·설정 변경 없음. Preview READY는 빌드 검증이며 실제 회원/Storage E2E 완료를 뜻하지 않는다. 공개 저장소에는 소스·문서·합성 fixture만 반영하며 .verification/개인사진/환경변수/쿠키/백업은 제외한다.
