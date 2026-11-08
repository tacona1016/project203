# BOARD 사진 500KB 자동 압축

2026-11-04. **로컬 구현·검증 완료 / 운영 미반영.** 이번 요청에 따라 GitHub push와 Vercel 배포는 수행하지 않았다. 기존 사진·DB·Storage 설정·환경변수는 변경하지 않았다.

## 정책과 알고리즘

- 원본: 정적 JPG/PNG/WebP, 한 장3MiB 이하, 기존16MP 디코딩 제한, 게시글당3장.
- 신규 저장: WebP, **실제 Buffer 길이500,000bytes 이하**. 500KiB(512,000bytes)와 다르다.
- 원본을 한 번 디코딩하고 EXIF 회전·sRGB 변환·긴 변 최대1920px 리사이즈 후 raw픽셀을 재사용한다. 비율을 유지하며 작은 원본을 확대하지 않는다.
- 각 해상도에서 quality82→76→70→64→58→52→45를 순서대로 시험한다. 초과하면 긴 변1920→1600→1280→1024→800으로 낮춘다. 동일한 실제 해상도가 반복되면 건너뛴다.
- 큰 해상도를 우선하고 해당 해상도에서 통과하는 가장 높은 시험 품질을 선택한다. 이전의 손실 압축 결과를 다시 압축하지 않는다.
- 최대35개 WebP 후보, 전체20초 deadline을 둔다. Sharp 처리 timeout과 별도의 요청 timer를 함께 적용해 thread 대기 시간도 제한한다. 시간 초과는503, 크기를 만족하는 후보가 없으면413이며 원본을 저장하지 않는다.
- alphaQuality100으로 투명도를 유지하고 EXIF/GPS/ICC/XMP를 저장하지 않는다. 투명 PNG의 alpha bytes와 EXIF 회전을 실제 코덱으로 검사했다. [Sharp 출력·메타데이터·WebP](https://sharp.pixelplumbing.com/api-output/), [Sharp 리사이즈](https://sharp.pixelplumbing.com/api-resize/).

## 서버 저장과 기존 사진 호환

`BOARD_IMAGES.bytes`는 원본/기존 사진 조회의3MiB 한도다. 신규 `storedBytes`만500,000이다. 코덱에서 크기를 측정하고 `uploadBoardImage()`에서도 DB 예약·Storage 업로드 전에 별도 크기 검사를 수행한다.

Storage MIME은 기존대로 `image/webp`, 경로는 기존 RPC가 만드는 `.webp`다. `byte_size`와 SHA256은 최종 Buffer 기준이다. 파일별 UUID, 작업 lease, pending/ready/deleting, 유실 ACK 재조회·재시도·멱등성 로직은 유지한다. 합성 API에서 동일 원본/UUID의 반복 업로드가 사진1개만 남기고 같은 해시를 사용하는지 검사했다.

기존 사진은 다시 인코딩하거나 이동·삭제하지 않는다. 조회 함수는3MiB 한도를 유지하므로500KB를 초과하는 과거 사진도 원래 bytes 그대로 전달한다. 실제 WebP로 생성한500KB 초과 과거 사진을 합성 Storage에 등록하고 GET 결과가 원본과 완전히 같은지 검사했다.

DB migration과 버킷 설정 변경은 **필요 없다**. 기존 DB 제약과 Private 버킷3MiB 한도는 과거 데이터와 호환되도록 유지한다. 브라우저의 직접 Storage 쓰기는 기존대로 차단되고 신규 BOARD 업로드는 서버의500,000bytes 검사 후에만 저장된다. 새 환경변수·npm 의존성도 없다.

## 화면 흐름

기존대로 사진을 선택하고 게시글을 저장하면 본문 저장 ACK 이후 사진을 개별 처리한다. 별도 압축 버튼은 없다.

- 선택: 사진 선택 완료 · 저장 시 자동 압축 및 업로드.
- 요청 중: 사진 압축 및 업로드 중.
- 성공: 업로드 완료와 최종KB, 상세 갤러리에도 사진 용량 표시.
- 실패: 사진별 업로드 실패 안내와 기존 재시도 기능. 이미 저장된 본문은 보존한다.

선택 화면은 ‘자동 압축 후 장당500KB 이하’와 ‘원본 한 장당3MiB 이하’를 별도로 안내한다. KB 표시는 실제 bytes/1000을 올림한다. 이미지 파일·Base64는 브라우저 임시저장에 넣지 않는다.

## 압축 실측

Sharp0.35.5, 결정적 합성 픽셀로 측정했다. 실제 회원 사진을 읽거나 외부 사진을 다운로드하지 않았다. 사진 내용에 따라 결과는 달라지며 아래 수치는 일반 압축률이나 주관적 화질을 보장하지 않는다.

| 합성 입력 | 원본 bytes | 저장 bytes | 최종 해상도 | quality | 후보 수 |
| --- | ---: | ---: | --- | ---: | ---: |
| 약1MB 고밀도 이미지 | 1,100,057 | 485,470 | 1280×960 | 45 | 14 |
| 3MiB 이하 고밀도 이미지 | 2,758,268 | 474,044 | 1280×960 | 58 | 19 |
| 스마트폰12MP 해상도 | 1,907,735 | 20,832 | 1920×1440 | 82 | 1 |
| 풍경 | 390,697 | 209,212 | 1920×1280 | 82 | 1 |
| 글씨·선 | 32,829 | 32,826 | 1920×1080 | 82 | 1 |
| 투명 PNG | 6,593 | 598 | 600×400 | 82 | 1 |

실측 원본은 Git에 저장하지 않으며 생성기는 `tests/fixtures/board-photo-samples.mjs`, 측정 결과는 Git 제외 `.verification/compression-samples.json`이다.

## 검증 결과

| 명령 | 결과 |
| --- | --- |
| `npm run check:conflicts` | 통과, build 전 단계에서도 실행 |
| `npm test` | 78/78 통과(기존68+신규10), 실패/skip0 |
| `npm run typecheck` | 통과 |
| `npm run lint` | 오류0, 기존 postcss 경고1 |
| `npm run build` | Next16.4.2 Production Build·MDX·공개 설정 검사 통과 |
| `npm run test:browser` | 실제 Next HTTP API 통합 및 Chrome40항목 통과 |

- 모든 성공 코덱 사례에서 실제 bytes≤500,000, WebP, 최종 크기/해시·비율·메타데이터 제거를 검증했다.
- 500KB 이하 입력,1MB/3MiB 이하 입력,12MP·풍경·글씨·투명 PNG·EXIF 회전 JPEG, 손상/MIME 변조/비지원/원본 초과·픽셀 제한을 검사했다.
- 투명 alpha를 유지하면서 최소 후보에서도500KB를 만족하지 못하는 극단적인 이미지는413으로 거부한다. 대기 중 전체 deadline 초과도 검사했다.
- 합성 API에서 최종 저장 bytes/DB 크기/SHA256/확장자·재시도·저장 실패 복구·과거500KB 초과 이미지 열람을 확인했다.
- Chrome에서 안내, 선택/실패/완료 상태와KB 표시, 실제 파일 선택·재시도·글/댓글/좋아요 보존,390/768/1440px 가로 넘침을 확인했다. 기존 회원·투표·Admin 회귀도 동일 harness에서 통과했다.
- 실제 운영 Supabase 업로드, Linux 배포와 Safari 실기기는 이번 검증에 포함되지 않는다. 이번 작업에서는 Production 배포를 수행하지 않았으며 운영 동작을 검증했다고 보고하지 않는다.

검증 중 알파 비교의 raw출력 누락과 Sharp 타입 표기 오류를 수정했다. 현재 테스트·타입·빌드는 모두 통과한다. 기존 ESM 안내 경고는 유지한다.

## 변경 파일과 적용 준비

| 파일 | 목적 |
| --- | --- |
| `lib/board/image-policy.ts` | 원본/기존 조회와 신규 저장 크기 분리 |
| `lib/board/image-codec.ts` | 적응형 WebP·알파·메타데이터·시간/후보 제한 |
| `lib/board/image-data.ts` | 업로드 전 출력 크기 재검증 |
| `components/board/BoardImagePicker.tsx` | 자동 압축 안내·상태·용량 |
| `components/board/BoardImageGallery.tsx` | 최종 용량 표시 |
| `tests/board-image-codec.test.mjs`, `tests/fixtures/board-photo-samples.mjs` | 실제 코덱·실측·실패 검증 |
| `tests/fixtures/board-extras.mjs`, `tests/integration/board-engagement.mjs` | 합성 과거 사진과 API 회귀 |
| `tests/integration/board-engagement-browser.mjs` | Chrome UI 회귀 |
| 이 문서·`docs/SESSION_HANDOFF.md`·기존 구현 보고서 | 정책/결과/인수인계 |

목록은 이번 작업 시작 해시 기준이다. 루트의 이전 미커밋 작업을 덮어쓰지 않았다. `BoardEditor`, 로그인·댓글·좋아요·투표 저장 로직, API 주소와 기존 migration은 변경하지 않았다.

배포 준비는 완료됐지만 이번 요청의 승인 전 push/Production 배포 금지를 따른다. 승인 후 앱 코드만 배포하면 되며 SQL 재실행이나 환경변수 변경은 하지 않는다. 이미 완료된 이전 BOARD migration도 반복 적용하지 않는다. 롤백은 앱 버전만 되돌리고 기존 사진은 보존한다.
