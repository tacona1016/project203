# 203 DeviceBook Presentation 검토 개발

> 2026-11-28 운영 반영 승인 후 `/quarter/2026-q4` 연결을 추가했다. 아래 내용은 로컬 시안 제작 당시 기록이다. 실제 운영용 구성과 공개 데이터 처리 방식은 [PRODUCTION_RELEASE.md](PRODUCTION_RELEASE.md)를 따른다.

## 현재 구성

기존 Q4 리디자인12장 뒤에 ‘설문 조사 결과’ 1장을 붙여 **총13장**으로 통합했다. 이전 12개 Slide 본문·숫자·순서·SVG·출처는 byte 비교로 보존한다.
원본 app/quarter/2026-q4/page.mdx와 운영 HOME/ARCHIVE/POLLS/BOARD/ADMIN, 인증·API·DB·Storage·환경변수는 변경하지 않았다.

독립 상세10장 화면과 링크·생성 코드를 제거했다. 예전 상세 MDX/PPTX는 ignored archive로 옮기고 검토 목록에서 제외한다. 데이터 JSON·분석 문서는 그대로 유지한다.
기존 /presentation-review/results 주소는 통합 발표자료의 마지막 장으로 연결한다. /presentation-review/results-detail은404다.

## 접속과 재현

- 전체 발표자료: http://127.0.0.1:3210/presentation-review/existing
- 마지막 장: http://127.0.0.1:3210/presentation-review/existing#results-overview
- 원본 디자인 비교: http://127.0.0.1:3210/presentation-review/original

작업 저장소 C:/project203/.verification/board-feature-branch에서 실행한다.

1. node --experimental-strip-types scripts/prepare-presentation-review.mjs
2. node --experimental-strip-types scripts/presentation-review.mjs
3. 별도 터미널: node tests/integration/presentation-review-browser.mjs --connect

실제 스냅샷이 로컬에 있어야 하며, 수치가 없으면 임의 파일을 생성하지 않는다.
정상 로그인 필요. 로컬 합성 계정 접속정보는 ignored review-access.local.json에 저장되고 로그/Git에 출력하지 않는다. 운영 비밀번호·회원 UUID·Secret을 복사하지 않는다.
review-app은 ignored 복사본이며127.0.0.1에만 바인딩한다. 회원 디렉터리 GET 이외 모든 backend 쓰기를 거부한다. 합성 인증/실제 집계 조합이며 운영 회원 E2E가 아니다.

## 구현

- 공통 Theme/Hero/Chart/Callout/Summary/Source 및 기존 MetricGrid alias를 사용한다. 스타일은 presentation-theme 범위만 적용한다.
- scripts/templates/poll-results-compact.mdx는 같은 private JSON을 사용하는 단일 Slide 조각이다. 생성기에서 번호13으로 추가하고 첫12장의 동일성과 anchor 중복을 검사한다.
- scripts/presentation-review-routes.mjs는 localhost 검토 Route만 설치한다. 예전 MDX 파일은 QA archive로 옮기며, 현재 작성 경로가 ignored workspace 내부인지 먼저 검사한다.
- data/quarter 등록이나 운영 MDX 경로에 새 Route를 넣지 않는다. 정상 앱 Build에 검토 Route는 없다.
- 읽기 모드에서 세로 스크롤/목차/anchor/진행률/이전·다음을 제공한다. 발표 모드는 한 장씩 표시하고, 전체화면 API가 거부되면 화면 내 발표 모드로 동작한다.
- 원본 비교는12장, 통합본은13장이다. 설문 요약은 PC에서 한 화면, 모바일에서는 세로로 읽는다. 사진·차트의 글자를 억지로 축소하지 않는다.

## 집계와 보안

7개 대상, canonical 현재 선택, distinct 응답자, 실제 마감과 결과 공개 정책을 검증한다. 운영 DB는 읽기 전용 집계만 사용했다.
성향은 사용자 확인 순서대로 거리(접근성)/토지 넓이/주변 환경/건축시기다. 문항번호1~4가 붙은 네 줄 응답은 번호와 점수를 구분하며, 정수1~4·합계10을 유지한다.
현재 평균/분포/중앙값/모집단 표준편차는 JSON과 분석 문서에 보관한다. 회원 이름·UUID·개별 원문은 내보내지 않는다. 공개 저장소에는 실제 결과·QA·스크린샷을 추가하지 않는다.
자세한 파서 수정은 [ALLOCATION_PARSER_CORRECTION.md](ALLOCATION_PARSER_CORRECTION.md), 참고 디자인과 라이선스는 [DEVICEBOOK_REFERENCE.md](DEVICEBOOK_REFERENCE.md)에 기록했다.

## 최종 검증

- 단위130/130 PASS, Typecheck PASS, lint오류0/기존경고1, conflict/presentation check/Production Build PASS.
- 통합 실제Chrome323항목:390/768/1440/1920, 원본12/통합13, 마지막 장·순서·표시값·목차·이전다음·키보드·발표모드·리다이렉트·상세주소404·인증·가로넘침/예외/hydration오류 검사 PASS.
- 첫 리다이렉트 검사는 browser fetch manual 응답이 opaque라는 점을 반영하지 못해 실패했으나, 실제 브라우저 이동 검사로 수정해 통과했다. 서버의307동작은 정상이었다.
- 기존 대규모 API/Storage 합성 통합검사는 이번 UI 통합에서 재실행하지 않았다. 해당 구현은 수정하지 않았고 기존 결과와 현재 실행을 구분한다.
- 이전 실제PG 읽기 전용 파서11종 및 통계 교차검증은 유지한다. 이번 통합은 스냅샷을 재사용하고 새 DB 조회/변경은 없다.

## 외부 서비스 상태와 적용 범위

2026-11-28 읽기 전용 재확인: GitHub main c49cf5f3833658138f981ef42ef296257f5ce443, Vercel Production dpl_5iQiRepVLMVqupZTHQnMjJPBFEW6 READY 및 같은 SHA, Supabase xpyyyqqfnlmgxxlenxua ACTIVE_HEALTHY.
현재 작업은 feat/devicebook-presentation-review의 로컬 검토본이다. root의 오래된 브랜치/미커밋 파일은 보존한다. GitHub Push/Production 배포/DB migration을 실행하지 않았다.

## 남은 범위

네이티브 Fullscreen, Safari 실기기 및 운영 회원 E2E는 미검증이다. 실제 폰트는 설치된 Noto Sans KR fallback으로 확인했고, Pretendard 파일 동봉·다크 모드는 미포함이다.
운영 발표자료 교체/배포는 별도 최종 승인 후 진행한다. 현재 통합에 DB 변경은 필요 없다.
