# 투표 생성과 이미지 원클릭 등록

2026-11-18. 기준 main `1645aad5eea72d5cf182aea6784ed3e8fd92b6d5`, 작업 브랜치 `feat/poll-images-on-create`. 루트의 오래된 코드·미커밋 문서를 보존하고 `.verification/board-feature-branch`에서 작업한다. 이번 작업은 기능 브랜치/PR/Preview까지만 진행하며 Production·운영 DB/Storage/환경변수는 변경하지 않는다.

## 변경된 흐름

기존에는 투표를 먼저 만든 뒤 `/edit`에서 사진을 별도로 첨부했다. 이제 제목·설명 아래 질문 사진 최대3장, 선택지별 사진1장을 브라우저에서 미리 선택한다. ‘투표 만들기’ 한 번으로 기존 생성 API → 실제 ID 검증 → 순차 압축/업로드 → ready 및 공개 상태 확인 → `/admin/polls/{slug}?created=1`로 이동한다. 완료 화면은 서버에서 읽은 실제 첨부 개수를 표시하며 질문/선택지 갤러리를 제공한다.

사진이 없으면 기존 생성 API를 한 번 호출하고 상세로 이동한다. 사진이 있으면 생성 요청을 임시 숨김으로 보내며, 모두 저장된 뒤 기존 hide/unhide API로 원래 공개 설정을 적용한다. 원래 숨김이었다면 계속 숨긴다. 기간·결과 공개 정책은 바꾸지 않는다.

## 상태와 ID 연결

- `DraftImage`: clientId(UUID/idempotency key), File, previewUrl(Object URL).
- `DraftOption`: 고유 clientKey, label, image. React key도 clientKey이며 중간 선택지 삭제 때 해당 파일·URL도 함께 제거한다.
- File과 미리보기는 메모리에만 보관한다. localStorage/sessionStorage/Base64/Storage 사전 업로드를 사용하지 않는다. 교체·제거·유형 변경·언마운트 시 URL을 revoke한다.
- 생성 후 기존 관리자 상세 API의 옵션을 display_order로 정렬해 수·순서(1부터)·문구·고유 ID·poll 소속을 검증한다. 검증된 위치를 clientKey → 실제 option_id Map으로 고정한다. 중복 문구도 각 키에 다른 ID가 연결된다. 재시도 중 ID/구성이 바뀌면 업로드를 중단한다.
- 객관식→주관식 전환 시 선택지 사진 제거를 확인하며 취소할 수 있다. 질문 사진은 유지한다.

## 저장·실패·재시도

`PollCreateFlow`는 생성된 slug와 검증된 ID, 이미지별 ready/error를 유지한다. 생성·업로드 중 동기 ref/클래스 busy 및 disabled fieldset으로 중복 클릭과 입력 변경을 막는다. 업로드 동시성은1이다. 질문 사진 먼저, 선택지 사진 다음에 저장한다.

- 업로드 일부 실패: 투표/성공 사진 삭제0, 자동 공개0. 기존 ready 목록을 확인한 뒤 실패한 파일만 동일 idempotency key로 재시도한다. 최종 목록 조회나 공개 ACK가 불확실해도 생성 API를 다시 호출하지 않는다.
- 생성 ACK 유실·5xx·비정상 성공 응답: 자동 재전송을 막고 관리자 목록에서 생성 여부 확인을 안내한다. DB 멱등성 구조를 새로 만들지 않았으므로 ‘서버 전역 exactly-once’를 주장하지 않는다. 명확한400/401/403/422 거부만 수정 후 재제출 가능하다.
- 생성 전 URL에 `creation=uncertain`, 생성 확인 후 `resume={slug}`를 replaceState로 남긴다. 본문·파일·비밀번호는 담지 않는다. 새로고침 시 파일은 사라지고 신규 생성 폼은 비활성화되며 목록 확인/기존 투표 수정 링크로 안내한다. 새로고침이 중복 생성으로 이어지지 않는다.
- 부분 실패 시 ‘저장된 이미지만으로 완료’를 확인 후 선택할 수 있다. 현재 ready인 사진만 인정하고 원래 숨김 설정을 적용한다. 미완료 pending 기록/성공 사진을 임의 삭제하지 않으며 기존 관리자 정리 기능으로 이어서 관리한다.
- 공개 변경 ACK가 유실되면 실제 상세를 재조회한다. 최종 사진 구성 변경이 발견되면 숨김으로 되돌린다. 관리자 간 동시 변경까지 원자적인 게시 트랜잭션을 추가한 것은 아니며, 기존 API와 재확인으로 보호한다.
- 이동/닫기 경고를 제공한다. 이동을 허용하고 폼이 언마운트되면 새 업로드·자동 공개를 멈추고 생성된 투표를 보존한다.
- 브라우저가 제공하는 취소 가능한 history 탐색 이벤트에만 뒤로가기 확인을 연결한다. Next App Router 이후의 popstate로 화면을 되돌리는 방법은 실제 검사에서 초안을 지키지 못해 제거했다. 일반 링크와 beforeunload 경고도 제공한다. 브라우저가 취소를 허용하지 않는 이동/종료까지 강제로 막는다고 주장하지 않으며, 실제 Safari는 미검증이다. [HTML 탐색 API 표준](https://html.spec.whatwg.org/dev/nav-history-apis.html).

## 재사용과 변경 파일

| 파일 | 변경 |
|---|---|
| `components/admin/PollEditor.tsx` | 메모리 초안, clientKey, 생성 진행/복구 UI, 잠금·이탈 경고, 한 번 생성 후 이어서 저장 |
| `components/admin/PollDraftImages.tsx` | 파일 선택·빠른 형식/3MiB 검사·미리보기·제거·순서 |
| `components/admin/PollImageManager.tsx` | 기존 즉시 저장 UI 유지, 공통 업로드 클라이언트 사용 |
| `lib/poll-images/client.ts` | 공통 fetch/검증/기존 헤더 업로드/ready 목록 ACK 복구 |
| `lib/poll-images/create-flow.ts` | 생성·ID 연결·순차 저장·재시도·최종 공개 조정, 독립 테스트 가능한 상태 흐름 |
| `app/admin/polls/[slug]/page.tsx` | 실제 첨부 개수의 완료 안내, 질문 갤러리 |
| `app/globals.css` | 초안 미리보기의 제한된 스타일2개 |
| `tests/poll-create-flow.test.mjs` | 생성/실패/불확실성/ID/취소/공유 업로드 회귀 |
| `tests/integration/poll-create{,-browser}.mjs` | 실제 Next API + 가짜 DB/Storage, 실제 Chrome 파일 입력·전체 흐름 |
| 기존 test harness/`choice-browser.mjs` | `--poll-create` 연결 및 생성 후 상세 이동 기대값 갱신 |
| `docs/SESSION_HANDOFF.md` | 진행·검증·운영 미반영 기록 |

기존 POST `/api/admin/polls`, GET `/api/admin/polls/{slug}`, 이미지 GET/POST/PATCH 및 hide/unhide API를 그대로 사용한다. 기존 API/RPC·DB·Storage·이미지 압축 엔진·회원/관리자 인증·BOARD·투표 제출/결과 집계·MDX는 변경하지 않는다. **신규 DB migration 불필요**, 기존 이미지 migration 재실행0이다. 입력 JPG/PNG/WebP 3MiB·16MP, 출력WebP500000bytes, private poll-attachments 정책을 유지한다.

## 검증

- 신규 단위16개 포함 전체118개 PASS(최종 실행 결과 기록 기준). 생성 ACK 유실, 중복 클릭, 부분 실패 후 단일 파일 재시도, ID/순서 불일치, 취소, 공개 ACK 재확인, 명시적 부분 완료를 검증한다.
- 신규 합성 HTTP5묶음 PASS: 기존 API 실제 호출, 질문1/3·선택지 일부·중복 문구·주관식·숨김, 실패/ACK 유실, 이전 votes/choice selections/comments 동일. 이는 실제 Supabase DB/Storage 검증과 다르다.
- 실제 Chrome5폭: 320/390/430/768/1440에서 파일 선택/미리보기(요청0), 중간 삭제 후 clientKey/option_id 연결, 숨김·순차 업로드·최종 공개/상세, 부분 실패·재시도·새로고침 복구, Object URL 해제를 확인한다. 최종 보강 검사 결과는 아래 기록한다.
- 기존 전체 Production-mode HTTP·Chrome45 회귀 PASS. 신규 뒤로가기/이미지 실제 로딩 보강 및 최종 코드 정적검사는 종료 시 결과를 갱신한다.
- 실제 PostgreSQL/Storage 쓰기·운영 회원 E2E·Safari 실기기는 미실행이다. 운영에 테스트 콘텐츠를 만들지 않았고 설정을 변경하지 않았다.

## 실행 명령과 배포

기존 scripts를 그대로 사용한다. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, conflict/presentation 검사. 신규 집중 검사는 `npm run test:integration -- --poll-create`, `npm run test:browser -- --production --poll-create`이며 기존 전체 `npm run test:integration`, `npm run test:browser`도 실행한다. `--production`은 기존 harness의 build/start 모드다.

기능 브랜치 커밋 → PR/CI → Git 연동 Preview 확인. Preview 필수 환경변수가 없으면 READY와 로그인 후 E2E를 구분한다. Production Secret을 복사하지 않는다. 운영 반영은 별도 승인 후 main 병합/배포만 필요하며 DB/Storage 작업은 필요 없다. 이전 앱으로 복귀해도 기존 데이터/사진은 그대로다.

GitHub PR·Preview URL과 최종 검사 결과는 완료 시 기록한다.

## 최종 로컬 검증 결과

| 명령 / 범위 | 결과 |
|---|---|
| npm run check:conflicts | PASS |
| npm run check:presentations | PASS |
| npm test | 118/118 PASS (기존102 + 신규16) |
| npm run typecheck | PASS |
| npm run lint | 오류0·신규경고0·기존 postcss 경고1 |
| npm run build | PASS |
| npm run test:integration -- --poll-create | 실제 Next + 합성 DB/Storage 5묶음 PASS |
| npm run test:browser -- --production --poll-create | 실제 Chrome 5묶음/5뷰포트 + 합성 HTTP5 PASS, 예외0/hydration0. 미리보기·서버 이미지 자연 해상도 로딩 확인 |
| npm run test:integration -- --production --poll-images --browser | 기존 수정/열람 이미지 HTTP8 + Chrome4 PASS |
| npm run test:browser -- --production | 기존 전체 HTTP23 + Chrome45 PASS |
| npm run test:browser | 기존 전체 HTTP24 + Chrome45 PASS |
| 운영 PostgreSQL 읽기 | 실제 get_poll_detail 옵션 필드 id/label/poll_id/display_order 및 admin_create_poll의 ordinality 사용 확인. 내용·신원 출력 없이 메타데이터만 조회 |
| 실제 PostgreSQL/Storage 쓰기·운영 회원 E2E | 미실행·운영 데이터 생성0. 독립 TEST 환경 없음 |

실제 스크린샷/측정은 ignored .verification/member-browser/poll-create-{320,390,430,768,1440}.png 및 poll-create-measurements.json에 있다. initial popstate 뒤로가기 시도가 실제 Next 탐색에서 실패한 결과도 QA 기록에 남겼다. 최종 구현은 탐색 전 취소 가능 이벤트로 처리하며 Chrome에서 취소 시 초안5개 유지가 통과했다. 사용자 파일은 브라우저 메모리에만 있고 테스트 이미지도 Git에 추가하지 않는다.
