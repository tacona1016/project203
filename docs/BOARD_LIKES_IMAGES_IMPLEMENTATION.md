# BOARD 수정·좋아요·비공개 사진 첨부

2026-11-03. 기존 인증·게시판/투표/MDX 데이터를 유지한 구현이다. 최초 로컬 검증 후 사용자가 개발·migration·배포를 사전 승인했다. **신규 DB migration 2개와 Private 버킷 적용은 완료됐다.** GitHub/Vercel 반영과 실제 접근 검증의 최신 진행 상황은 `docs/SESSION_HANDOFF.md`를 따른다. 기존 데이터·과거 migration은 변경하지 않았다.

## 1. 상태와 현재 구현 확인

| 항목 | 상태 | 확인 범위 |
| --- | --- | --- |
| 게시글 수정 | 구현 완료 / 테스트 완료 | 기존 RPC·작성자/관리자 정책 재사용, 제목/본문·수정 시각·취소·이탈 경고·관계 보존 |
| 댓글 수정 | 구현 완료 / 테스트 완료 | 기존 UI/PATCH 재사용. 운영 RPC 존재·SECURITY INVOKER·익명 실행 차단·server 실행 허용을 읽기 확인. 재생성 안 함 |
| 게시글·댓글 좋아요 | 구현 완료 / 테스트 완료 / DB 적용 완료 | 합성 API·Chrome, 실제 DB 권한·조회 RPC 검증. 실제 DB 쓰기 동시성은 미검증 |
| 사진 업로드·열람·삭제 | 구현 완료 / 테스트 완료 / 버킷 적용 완료 | 실제 Sharp 및 합성 Storage API·Chrome. 실제 Storage 업로드는 미실행 |
| DB/Storage SQL·TEST SQL | 구현 완료 / 신규 migration 운영 적용 완료 | 서버 발급 version으로 이력 저장. 별도 TEST PostgreSQL 행위 검증 필요 |
| 앱 배포 | 진행 중 | 사용자 사전 승인에 따라 GitHub·Vercel 반영. 인계 문서에서 최신 결과 확인 |

시작 시 원격 main/Production은 `03118e2`, READY였다. root는 `.git` 쓰기 제한 때문에 이전 복구 미커밋 변경을 보존한 `fix/rebase-integrity` 상태였다. 원격은 연결 도구로 확인했다. rebase와 충돌 마커는 없었다. 시작231파일 해시는 `.verification/board-features-baseline.json`에 보존했다. 별도 로컬 검토 저장소 `.verification/board-feature-branch`의 `feat/board-likes-images`에 체크포인트를 보관한다. root의 기존 변경을 초기화하거나 main을 갱신하지 않았다.

## 2. 게시글·댓글 수정

- 게시글은 기존 `write_board_post`로 본인의 일반 글 또는 관리자 권한으로 수정한다. 공지·고정 정책과 서버 세션에서 작성자를 결정하는 구조는 그대로다.
- 댓글은 기존 `edit_board_comment(bigint,bigint,uuid,text)`로 본인만 수정한다. 관리자도 다른 사람의 댓글 내용을 바꾸지 못하고 기존 삭제 권한만 유지한다. 2,000자 제한·취소·즉시 반영·수정 시각을 유지했다.
- 글/댓글 ID를 바꾸거나 기존 관계를 재할당하지 않는다. 수정 전후 댓글·좋아요·기존 사진 보존을 검사했다.
- 사진 부분 실패 후에는 이미 저장된 제목/본문과 설정을 잠그고 사진만 재시도한다. 저장된 글을 중복 생성하거나 자동 삭제하지 않는다. 임시저장에는 텍스트만 포함한다.

## 3. 좋아요 DB와 API

신규 `board_post_likes(post_id,participant_id,created_at)`와 `board_comment_likes(comment_id,participant_id,created_at)`에 각각 복합 PK와 실제 FK를 둔다. 기존 soft delete와 호환되며 수정은 좋아요 행에 영향을 주지 않는다.

`set_board_like`는 부모 게시글을 잠그고 활성 회원·댓글의 부모/삭제 상태를 확인한다. PUT은 `INSERT ... ON CONFLICT DO NOTHING`, DELETE는 본인 행만 제거하므로 같은 요청을 다시 보내도 누적되거나 토글이 두 번 일어나지 않는다. SQL과 API 모두 회원 UUID를 서버 세션에서 사용한다. Supabase Auth의 auth.uid()를 회원 UUID로 가정하지 않는다.

| API | 기능 |
| --- | --- |
| `GET/PUT/DELETE /api/board/posts/[id]/like` | 조회·추가·취소 |
| `GET/PUT/DELETE /api/board/posts/[id]/comments/[commentId]/like` | 댓글 조회·추가·취소 |

응답은 `{count,liked}`뿐이며 좋아요 회원 목록을 반환하지 않는다. 댓글은 페이지당 최대30개 ID를 한 번의 `get_board_engagement` RPC로 조회한다. 댓글마다 추가 요청을 만들지 않는다. 새 SQL이 아직 없거나 일시 오류가 나면 좋아요는 미확인 상태이며 기존 글/댓글은 계속 표시한다.

버튼은 즉시 낙관적으로 바뀌고 중복 클릭을 잠근다. 실패 시 이전 값을 복원하고 GET으로 실제 저장 상태를 다시 확인한다. 확인까지 실패하면 추가 변경 대신 ‘상태 확인’을 제공한다. 44px 터치 영역과 aria-pressed를 사용한다.

## 4. 사진 가능성·Storage 구성

시작 시 운영 읽기 확인 결과 Free 플랜, 기존 버킷0개, 새 테이블0개였다. 이후 사전 승인에 따라 SQL로 새 테이블과 Private 버킷을 생성했다. RLS·브라우저 table/RPC 차단과 서버 조회 RPC를 운영 DB에서 검증했고 Security Advisor 경고는0개다. **실제 Storage 업로드는 실행하지 않았다.** 로컬에서 Storage API와 기존 DB를 호출한 검사는 모두 네트워크 연결 단계에서 실패했으며 이를 비밀번호·키 오류로 판정하지 않았다.

- 버킷: `board-attachments`, 반드시 **Private**.
- 저장 MIME: 재인코딩한 `image/webp`만 허용, 버킷 제한3MiB.
- 원본 허용: JPEG/PNG/WebP, 한 장3MiB, 글당 최대3장. GIF/SVG/HTML/HEIC/AVIF·애니메이션은 지원하지 않는다.
- 일반 회원은 다른 회원의 사진을 열람할 수 있다. 추가·삭제는 작성자만 가능하다. 관리자도 남의 사진을 바꾸지 못하지만 기존 글 내용·삭제·공지 관리 권한은 유지한다. 공지 첨부 변경에는 작성자와 관리자 추가 인증이 모두 필요하다.
- 사이트 장식 사진은 `private-assets/site/`를 그대로 사용한다. 이 기능과 섞지 않는다.

Vercel 함수의 요청/응답 한도는4.5MB다. 따라서 파일을 multipart 묶음이 아닌 3MiB 이하 raw 요청으로 한 장씩 전송한다. [Vercel 공식 제한](https://vercel.com/docs/functions/limitations)

## 5. 이미지 보안

확장자/브라우저 MIME만 믿지 않는다. 서버가 세션·소유자·동일 출처를 확인하고 스트림 길이를 제한한 다음 시그니처와 실제 디코더 형식을 비교한다. Sharp로 실제 디코딩하며 최대16MP·다중 프레임 거부·최대2400px·10초 처리 제한을 적용한다.

방향 정보를 먼저 적용하고 WebP로 재인코딩한다. EXIF/GPS/ICC/XMP 등 원본 메타데이터는 유지하지 않는다. 기존 Next 잠금 파일에 있던 Sharp0.35.5를 직접 의존성으로 승격했다. [Sharp 기본 메타데이터 제거](https://sharp.pixelplumbing.com/api-output/#keepmetadata)

이미지는 인증된 `GET /api/board/posts/[id]/images/[imageId]`로만 전달한다. 내부 Storage 경로·해시·업로드 토큰·Secret Key·signed/public URL은 브라우저에 반환하지 않는다. UUID/부모 글/삭제 상태를 검증하고 보관 bytes의 크기·해시도 확인한다. 런타임에서도 bucket.public이 false인지 확인한다.

이미지 응답은 private/no-store, CDN no-store, Vary: Cookie, nosniff, WebP Content-Type이다. plain img를 사용하며 기존 Next localPatterns는 private API 최적화를 허용하지 않는다. 비로그인 URL·공개 버킷 설정·optimizer 우회 거부를 합성 API에서 확인했다.

## 6. 첨부 DB·원자성·복구

신규 `board_post_images`에는 UUID, 글/작성자 FK, 내부 경로, MIME/크기/너비/높이,0~2번 슬롯, SHA256, `pending/ready/deleting`, 작업 토큰과 시각을 저장한다. `(post_id,sort_order)`와 경로가 유일하다.

DB와 Storage를 한 PostgreSQL transaction으로 묶을 수 없으므로 추적 가능한 상태 전이를 사용한다.

1. 본문 저장 ACK 이후에만 사진을 처리한다. 서버 디코딩 후 DB에서 슬롯·용량을 예약한다. 짧은 DB 잠금으로 동시 네 번째 사진을 막는다.
2. 파일별 UUID 멱등 키와 정규화 bytes 해시를 사용한다. 같은 키/같은 파일의 완료 재요청은 기존 사진을 반환한다. 다른 내용/다른 소유자의 키 재사용은 거부한다.
3. Storage는 upsert 없이 업로드한다. 이전 요청의 동일 object가 있으면 해시를 확인해 복구한다. DB ready ACK가 유실돼도 상태를 조회해 확정한다.
4. 실패 정리는 DB에서 pending 상태를 원자적으로 claim한 뒤 Storage를 제거하고 메타데이터를 purge한다. ready가 된 사진은 늦은 abort로 지우지 않는다.
5. 삭제도 먼저 deleting으로 표시한 뒤 Storage 제거 성공 후 메타데이터를 제거한다. 실패 시 행/경로를 유지해 재시도한다. 파일 제거가 불확실하면 추적 행을 지우지 않는다.
6. 중단된 같은 업로드는2분 lease 이후 동일 UUID로 재개할 수 있다. API 최대 실행60초보다 lease가 길다. 실패한 파일만 재전송하며 게시글은 유지된다.

저장 용량은 pending/deleting 포함 회원당75MiB·전체750MiB로 예약 단계에서 제한한다. 삭제된 글의 사진은 새 요청에서 즉시 열람 차단하되 물리 삭제는 별도 정리로 처리한다.

## 7. 정리 도구

`node scripts/cleanup-board-images.mjs`는 기본적으로1일 이상 중단된 작업 또는 삭제된 글의 첨부 후보 **개수만 조회**한다. 최대100개 단위다. 자동 실행/cron은 없다.

운영 정리는 대상·백업·후보를 검토하고 승인받은 뒤에만 `--apply --confirm-board-image-cleanup`을 함께 사용한다. RPC claim → Storage remove → DB purge 순서이며 ready인 정상 글 사진은 제외한다. 경로/회원/키/본문은 로그에 출력하지 않는다. 이번에는 실제 정리를 실행하지 않았다.

## 8. 작성·열람 UX

작성 화면에서 파일을 선택하면 메모리 blob 미리보기를 제공한다. 로컬 파일/이미지 Base64는 localStorage에 넣지 않고 제거·화면 종료 시 URL을 해제한다. 수정 화면은 기존 사진과 새 사진을 구분하며 삭제를 저장 전까지 취소할 수 있다.

저장 중 버튼을 잠그고 파일별 대기/업로드/실패 상태를 표시한다. 부분 실패 시 본문은 저장된 상태로 남고 실패 사진만 재처리한다. 상세 화면은 사진이 있을 때만 반응형 갤러리를 표시한다. 클릭 확대·닫기·ESC·포커스 복귀를 제공한다.

## 9. 변경 파일

| 영역 | 파일 |
| --- | --- |
| 기존 기능 연결 | `lib/board/{data,types}.ts`, `lib/supabase/types.ts`, `app/board/[id]/page.tsx`, `components/board/{BoardEditor,BoardComments}.tsx` |
| 신규 서버 | `lib/board/{engagement,feature-http,image-policy,image-codec,image-data}.ts` |
| 신규 API | `app/api/board/posts/[id]/like/route.ts`, 댓글 `[commentId]/like/route.ts`, `images/route.ts`, `images/[imageId]/route.ts` |
| 신규 UI | `components/board/{BoardLikeButton,BoardImageGallery,BoardImagePicker}.tsx`, `lib/board/image-client.ts`, `app/globals.css` |
| SQL·정리 | `supabase/proposals/{board_likes_images,board_attachments_bucket}.sql`, `supabase/tests/board_likes_images.sql`, `scripts/cleanup-board-images.mjs` |
| 검사 | `tests/{board-image-codec,board-image-maintenance}.test.mjs`, `tests/fixtures/{board-server,board-extras}.mjs`, `tests/integration/{board-engagement,board-engagement-browser,member-auth,member-browser}.mjs` |
| 의존성·문서 | `package.json`, `package-lock.json`, `README.md`, `docs/board.md`, 이 보고서, `docs/SESSION_HANDOFF.md` |

정확한 시작 대비 변경 목록과 중요 파일 보존 결과는 Git 제외 `.verification/board-features-changed-files.json`에 기록한다. 오래된 root HEAD diff와 이전 복구 변경을 혼동하지 않는다.

## 10. 테스트·빌드

| 실행 | 결과 | 범위 |
| --- | --- | --- |
| `npm test` | 테스트 완료:68/68, 실패/skip0 | 기존64개+실제 Sharp 코덱3개+정리 도구 안전 가드1개 |
| `npm run typecheck` | 테스트 완료 | Next typegen+strict tsc |
| `npm run lint` | 테스트 완료:오류0/기존경고1 | 기존 postcss anonymous export 경고만 유지 |
| `npm run build` | 테스트 완료 | 충돌/발표 검사+Next Production Build |
| `npm run test:integration` | 테스트 완료 | 합성 HTTP DB·Storage, 실제 Next API. 최신 확장 검사는 browser 실행에도 포함 |
| `npm run test:browser` | 테스트 완료:39항목 | 실제 Chrome,390/768/1440px 사진/좋아요/실패 재시도 및 기존 화면 |
| `npm run test:production` | 테스트 완료 | 최종 로컬 합성 fixture build/start·보호된 API. 실제 Vercel 배포 아님 |

단위·타입·lint·build·합성 API/실제 Chrome·로컬 production fixture를 구분한다. 새 코덱 단위는 실제 Sharp로 JPEG/PNG/WebP 재인코딩·EXIF 제거·크기/픽셀/변조 거부를 검사한다. Git 제외 `.verification/member-browser/board-likes-images-{390,768,1440}.png`와 `report.json`에 실제 화면/검사 기록을 남겼다.

새 합성 API는 본인/타인·관리자·비활성·CSRF/위조 입력, 좋아요 멱등/동시 요청/편집 후 보존/댓글 페이지, 이미지 MIME/크기/3장 동시성·개인 열람·삭제·Storage/DB 실패·유실 ACK·재시도를 검사한다. Chrome은 실제 파일 선택·미리보기·부분 실패 후 단일 게시글 재시도·좋아요·사진 교체·확대/ESC와390/768/1440px를 확인한다.

**실제 PostgreSQL SQL 실행·다중 연결 잠금과 실제 Supabase Storage 업로드는 미검증이다.** 합성 서버의 동시성 검사를 실제 DB 잠금 검증으로 보고하지 않는다. TEST SQL은 명시 확인을 요구하고 ROLLBACK하지만 시퀀스 번호는 증가할 수 있다.

## 11. 비용·플랜 제한

확인한 조직은 Free다. 공식 가격표 기준 Free는 file storage1GB, uncached egress5GB 및 cached egress5GB를 포함한다. Pro는 월$25부터,100GB storage 포함·초과$0.0213/GB, uncached egress250GB 포함·초과$0.09/GB다. 요금은 조직 전체 사용량·다른 기능과 합산될 수 있다. [Supabase 공식 가격표](https://supabase.com/pricing)

이번 이미지 응답은 인증 보호 때문에 no-store다. 재열람도 Supabase→Vercel 전송과 Vercel→브라우저 전송을 소비한다. Supabase cached quota를 그대로 활용한다고 가정하지 않는다. 예를 들어 정규화 사진300장이 평균0.3MB라면 약90MB 저장,10명이 각각 한 번 보면 약900MB 전송이다. 이는 설명용 계산이며 실제 사용량·압축률·무료 유지 여부를 보장하지 않는다. 고정 요금제 변경·결제·자동 과금 설정은 하지 않았다.

## 12. 적용 이력과 후속 검증 순서

적용 완료: `supabase/migrations/20261103143211_board_likes_images.sql`, `20261103143219_board_attachments_bucket.sql`. MCP가 실제 발급한 version을 사용했으며 과거 migration은 재실행하지 않았다. 버킷은 Private·3MiB·WebP 전용이고 세 신규 테이블은 RLS 활성/anon·authenticated 직접 접근 차단이다. 아래 절차는 새 환경이나 후속 테스트를 위한 설명이며 **현재 운영 DB에 이미 적용한 SQL을 재실행하지 않는다.** 일반적인 적용·배포 승인은 `docs/DEVELOPMENT_AUTHORIZATION.md`에 기록돼 있다.

1. 기존 migration 이력과 스키마를 확인하고 서버가 발급한 새 migration 두 개만 적용했다. 기존 schema/seed/migration은 재실행하지 않았다.
2. 신규 RLS·table/RPC 권한·Private bucket·용량/MIME와 실제 서버 조회 RPC를 검증했다. 기존8개 테이블의 전체 행 지문이 적용 전후 동일하다. Security Advisor 경고는0개다.
3. 새 환경변수는 없다. 현재 Vercel에는 필수 항목이 Production에만 등록돼 있다. 값은 읽거나 변경하지 않았다. Preview에서 실제 인증 기능을 검증하려면 별도의 테스트 환경 설정이 필요하다.
4. 최신 원격 tree를 parent로 기능 commit을 만들고 일반 fast-forward로 main에 반영한 뒤 Vercel Linux 빌드·Production READY·비로그인 보호 응답을 확인한다. 강제 push와 이력 변경은 하지 않는다.
5. 별도 TEST PostgreSQL에서 `supabase/tests/board_likes_images.sql`과 두 연결 동시 요청을 확인하는 검사는 여전히 필요하다. 현재 운영 DB에 가짜 회원/게시글이나 테스트 사진을 생성하지 않는다.
6. 회원 로그인 후 실제 Storage 업로드·삭제 E2E, Safari 실기기와 백업/복구 리허설은 별도 테스트 환경에서 확인한다. 프로젝트 global 파일 제한도3MiB 이상이어야 한다.

## 13. 롤백·미완료

앱을 이전 버전으로 되돌려도 새 테이블/버킷을 삭제하지 않는다. 좋아요·첨부 metadata/object를 보존하고 후속 호환 앱으로 복구한다. 업로드된 개인 사진을 public으로 옮기거나 DB만 먼저 지우지 않는다. 기존 글/댓글/투표·UUID는 변경하지 않는다.

미완료: 별도 TEST PostgreSQL 동시성·실제 Storage 업로드/삭제, 실제 운영 회원 E2E, Safari 실기기, HEIC/AVIF/댓글 사진·자동 정리 스케줄. 로컬 새 npm 의존성 다운로드는 오프라인 캐시 제한으로 실행하지 못했고 이미 설치된 동일 잠금 버전 Sharp를 사용했다. Linux 설치·빌드 검증과 앱 배포의 최신 결과는 세션 인계에 기록한다. 운영 SQL·Private 버킷 적용은 완료됐으며 정리 작업은 실행하지 않았다.
