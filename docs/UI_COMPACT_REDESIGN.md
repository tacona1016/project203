# UI 간결화 및 HOME 재배치

2026-11-04. 로컬 구현·검증 완료. GitHub push와 Vercel Production 배포는 수행하지 않았다.

## 1. 개선 방향

기존 배경 `#fffefa`, 보조 배경 `#f2f2ed`, 텍스트 `#20241f`, 포인트 `#2453df`와 미니멀한 디자인을 유지했다. 제목·이미지·반복 안내의 높이를 줄이고, 읽기와 참여에 필요한 정보부터 보이도록 정리했다. 새로운 라이브러리, 환경변수, DB 구조는 추가하지 않았다.

이번 작업 시작 시점의 259개 파일 해시를 `.verification/compact-baseline.json`에 저장했다. 루트 Git diff에는 이전 BOARD·사진 압축·충돌 복구 작업도 있으므로, 아래 변경 목록과 검증은 이번 시작 시점과 비교한 결과다. 기존 미커밋 작업은 보존했다.

## 2. HOME 변경 전 / 후

| 변경 전 | 변경 후 |
| --- | --- |
| 소개 → 현황 → 할 일 → 투표 → 공지 → 발표자료 → 로드맵 → 일정 | 소개 → **최신 발표자료 → 투표 현황** → 현황과 다음 행동 → 공지 → 로드맵 → 일정 |
| 현황 미정 항목과 할 일 안내 반복 | 미확정 상태는 한 문장으로 안내 |
| 마감 임박·최근 투표 별도 목록에 같은 항목 반복 | 미참여 우선, 마감순·최근순으로 정렬한 최대 3개 |
| 큰 제목과 이미지로 상단 대부분 사용 | 간결한 소개와 160px / 224px 대표 이미지 |

실제 React 렌더 순서를 변경했다. CSS `order`로 재배치하지 않았다. 최신 발표자료 바로 다음 형제 섹션이 투표 현황인지 HTTP HTML과 실제 Chrome DOM 양쪽에서 검증한다.

- 기존 `current-feature`, `QuarterCover`의 색상과 그래픽을 유지했다. PC는 2열, 모바일은 세로 배치다.
- 분기·제목·공개일·두 줄 설명과 발표자료 보기 버튼을 표시한다. 발표자료 공개 여부 판정은 기존 로직을 사용한다.
- `projectStatus`가 없으면 “현재 프로젝트 단계와 다음 행동은 논의 후 업데이트됩니다.”만 표시한다. 값이 있으면 현재 단계·다음 행동·실제 기준일을 표시한다.
- 실제 후보지가 있을 때만 마지막 비교 영역이 나타나는 조건을 유지했다. 운영 후보지나 프로젝트 상태를 임의로 추가하지 않았다.

## 3. 여백과 크기

일반 페이지와 HOME에 한정해 CSS를 추가했다. MDX 원문, `presentation-slide`, `presentation-hero`, 발표 목차와 이동 컴포넌트는 변경하지 않았다. 기존 CSS 전체를 유지하고 HOME 안의 QuarterCover만 별도로 조정했다.

| 대상 | 변경 전 | 변경 후 |
| --- | --- | --- |
| HOME 주요 섹션 아래 | 주로 80~112px | 모바일 48px / 태블릿 이상 56px |
| 일반 페이지 상단 | 48~96px | 32px / 태블릿 이상 40px |
| 페이지 제목 아래 | 40~72px | 24px |
| 일반 페이지 제목 | 최대 72px | 32~44px |
| HOME 제목 | 최대 120px | 36~64px |
| HOME 대표 이미지 | 192~400px | 모바일 160px / 태블릿 이상 224px |
| 최신 발표자료 내부 | 기존 넓은 패딩 | 모바일 20px / 태블릿 이상 24px |
| 투표 목록 행 위아래 | 각 32px | 각 16px |
| BOARD 배너 | 160~320px | 모바일 112px / 태블릿 이상 144px |
| BOARD 목록 행 위아래 | 각 24px | 각 14px |
| 관리자 통계 내부 | 24px | 16px |
| 관리자 폼 섹션 여백·하단 패딩 | 각각 48px | 각각 24px |

주요 버튼과 입력창의 44px 조작 높이는 유지했다. BOARD 행 전체를 기존 상세 링크의 클릭 영역으로 확장해 행을 줄이면서 터치 범위를 확보했다.

## 4. POLLS

- 제목·진행 상태·내 참여 상태·시작/마감·행동 링크를 우선 표시한다.
- 설명과 상세 투표 정책은 목록의 “투표 정보”를 열어 확인한다. 참여율은 기존 서버 응답에서 결과가 공개된 경우에만 표시한다.
- 투표 상태와 내 참여 여부의 두 축 필터 기능을 유지하되, 작은 화면에서 각 필터가 간결한 한 줄이 되도록 정리했다.
- HOME은 현재 분기의 실제 진행 중 수와 내 미참여 수를 표시한다. 참여 상태 조회 실패를 미참여 0개로 바꾸지 않는다.
- HOME 목록은 미참여 → 확인 불가 → 참여 완료, 같은 그룹에서는 마감 임박 → 최근 등록 순으로 최대 3개다. 중복된 마감 임박/최근 목록을 제거했다.
- 단일·복수선택, 선택 변경, 주관식, 저장 트랜잭션, 결과 공개, 익명성 관련 데이터 처리 로직은 수정하지 않았다.

## 5. BOARD

- 배너와 제목 아래에 검색·글쓰기, 고정 공지, 일반 목록, 페이지네이션을 배치했다.
- 헤더와 중복되는 별도 회원 안내 박스는 목록에서 제거했다. 작성·수정 화면의 인증 및 권한은 그대로다.
- PC에서는 제목과 메타정보를 한 행에, 모바일에서는 제목과 작성정보를 두 줄에 표시한다. 긴 제목은 말줄임하고 상세 링크는 유지한다.
- 공지·NEW·댓글 수를 유지하고 글쓰기를 Primary Action으로 표시한다.
- 게시글·댓글 수정, 좋아요, 사진 미리보기/업로드/재시도/확대 코드는 변경하지 않았다. 직전 작업의 신규 사진 WebP 500,000bytes 압축 정책도 유지했다.

## 6. ARCHIVE

- 페이지 제목을 “발표자료”로 정리하고 분기·제목·발표자료 링크가 먼저 보이도록 했다.
- 공개 자료가 6개 이하이고 검색 조건이 없으면 검색/연도를 접는다. 검색 조건이 있거나 자료가 늘면 기본으로 펼친다.
- 기존 검색·연도 조건, 공개 여부, MDX 경로는 유지했다. 발표 슬라이드 자체는 축소하지 않았다.

## 7. ADMIN과 공통 메뉴

- 투표 만들기와 공지 작성 버튼을 통계보다 앞에 배치했다.
- 기존 6개 통계는 모바일 2열, 태블릿 3열, PC 6열로 간결하게 정리했다.
- 분기 바로가기는 가로 탐색, 폼은 섹션 간격을 줄였다. 통계 산출·필터·투표 설정·추가 인증은 그대로다.
- 공통 메뉴는 “홈 / 발표자료 / 투표 / 게시판 / 관리”로 표시한다. URL, 활성 메뉴, 모바일 열기/닫기·ESC·외부 클릭·로그아웃은 유지했다.

## 8. 실제 브라우저 검증과 화면 비교

테스트 회원·합성 DB/Storage를 사용하는 로컬 Next.js와 실제 Chrome으로 검증했다. 운영 회원이나 운영 콘텐츠를 사용하지 않았다.

- 신규 간결한 UI 검증: 390 / 768 / 1440px에서 HOME·분기별 POLLS·BOARD·ARCHIVE·ADMIN, 총 15개 화면 캡처.
- 기존 브라우저 회귀 검증에는 320 / 430px, 로그인 자동완성, 모바일 메뉴, 투표 제출/변경, BOARD 좋아요·사진 업로드, 관리자 폼도 포함한다.
- DOM 순서, 최신 발표자료와 투표의 인접 관계, 최대 3개 투표, Archive 접기/펼치기, 투표 상세 접기/필터, 관리자 주요 버튼 위치, 가로 넘침 부재를 자동 검증했다.

| 뷰포트 | HOME 이미지 높이 | 발표자료 버튼 하단 좌표 | BOARD 배너 | BOARD 첫 행 높이 |
| --- | --- | --- | --- | --- |
| 390 × 900 | 160px | 약 746px | 112px | 약 75px |
| 768 × 900 | 224px | 약 673px | 144px | 약 51px |
| 1440 × 960 | 224px | 약 684px | 144px | 약 51px |

위 수치는 fixture 제목과 내용을 사용한 실측이다. 글 길이·사용자 글꼴·뷰포트 높이에 따라 달라진다. 모바일 390px와 PC HOME, 모바일 POLLS/BOARD/ADMIN, 태블릿 ARCHIVE 캡처를 직접 열어 시각적으로도 확인했다.

화면 자료는 Git에서 제외되는 `.verification/`에 보관한다. Before 12장은 직전 작업에서 실제 Chrome으로 촬영한 이번 시작 UI와 동일한 화면을 보존한 것이다. 이번에 새로 촬영한 Before라고 표기하지 않는다.

| 비교 화면 | Before | After |
| --- | --- | --- |
| HOME 모바일 | [이전 화면](../.verification/compact-before/ui-home-390.png) | [개선 화면](../.verification/member-browser/ui-home-390.png) |
| HOME PC | [이전 화면](../.verification/compact-before/ui-home-1440.png) | [개선 화면](../.verification/member-browser/ui-home-1440.png) |
| POLLS 모바일 | [이전 화면](../.verification/compact-before/ui-polls-390.png) | [개선 화면](../.verification/member-browser/ui-polls-390.png) |
| BOARD 모바일 | [이전 화면](../.verification/compact-before/ui-board-390.png) | [개선 화면](../.verification/member-browser/ui-board-390.png) |
| 관리자 투표 폼 모바일 | [이전 화면](../.verification/compact-before/ui-admin-new-390.png) | [개선 화면](../.verification/member-browser/ui-admin-new-390.png) |

ARCHIVE와 관리자 대시보드는 같은 경로의 Before가 없어 After만 제공한다: [ARCHIVE 768px](../.verification/member-browser/compact-archive-768.png), [ADMIN 390px](../.verification/member-browser/compact-admin-390.png). 나머지 뷰포트 캡처와 측정값은 `.verification/member-browser/compact-*.png`, `compact-measurements.json`에 있다. QA 파일은 자동 커밋되지 않으므로 다른 기기에서는 테스트 재실행이 필요하다.

## 9. 변경 파일

이번 작업 시작 시점 대비 수정 23개, 신규 4개다. 이전 미커밋 변경을 이번 UI 변경으로 계산하지 않았다.

| 파일 | 목적 |
| --- | --- |
| `app/page.tsx` | 실제 HOME 렌더 순서와 간결한 Hero/발표자료 |
| `app/globals.css` | 일반 페이지와 HOME에 한정한 밀도·반응형 규칙 |
| `app/polls/page.tsx` | 간결한 분기 제목·한글 페이지명 |
| `app/board/page.tsx` | 검색/글쓰기 우선 배치, 목록 정리 |
| `app/archive/page.tsx` | 검색/연도 접기와 제목 정리 |
| `components/SiteNav.tsx` | 동일 경로의 한글 메뉴 |
| `components/SitePage.tsx` | 공통 설명 타이포그래피 |
| `components/home/ProjectTasks.tsx` | 현황/다음 행동 통합과 미확정 안내 |
| `components/home/LatestNotices.tsx` | 공지 목록 간격 |
| `components/home/ProjectRoadmap.tsx` | 로드맵 제목·여백 |
| `components/home/UpcomingEvents.tsx` | 일정 제목·빈 상태 |
| `components/project/LandComparison.tsx` | 기존 조건부 후보지 영역 식별 |
| `components/polls/PollCatalog.tsx` | 최대 3개 HOME 투표, 중복 요약 제거 |
| `components/polls/PollCard.tsx` | 제목/상태/내 참여/행동 우선, 상세 접기 |
| `components/polls/ParticipationRate.tsx` | 공개 결과의 간결한 참여율 표시 |
| `components/polls/PollDeadline.tsx` | 기존 마감 안내의 간결한 표시 옵션 |
| `components/polls/QuarterPolls.tsx` | 두 축 필터와 이전 분기 목록 간격 |
| `components/admin/AdminWorkspace.tsx` | 주요 행동 상단 배치와 통계/분기 필터 |
| `components/admin/AdminPollList.tsx` | 관리 목록 제목·행동 간격 |
| `tests/integration/member-auth.mjs` | 실제 HTML의 HOME 순서 회귀 검증 |
| `tests/integration/member-browser.mjs` | 신규 Chrome 검증 통합·새 현황 문구 |
| `tests/integration/ui-ux-browser.mjs` | 의도한 이미지/배너 높이 검증 |
| `docs/SESSION_HANDOFF.md` | 작업 진행·완료·검증 인계 |
| `lib/home-view.ts` **신규** | 데이터 처리와 분리된 HOME 투표 정렬 |
| `tests/home-view.test.mjs` **신규** | 최대 개수/정렬/비공개/unknown 회귀 |
| `tests/integration/compact-browser.mjs` **신규** | 세 뷰포트 DOM·치수·동작 검증 |
| `docs/UI_COMPACT_REDESIGN.md` **신규** | 본 보고서 |

## 10. 테스트 결과

| 실행 명령 | 결과 |
| --- | --- |
| `npm run check:conflicts` | 통과. Production Build에서도 실행 |
| `npm run check:presentations` | 통과. 공개 MDX/분기 검증 |
| `npm test` | **80 / 80 통과**, 실패·skip 없음 |
| `npm run typecheck` | 통과 |
| `npm run lint` | 오류 0, 기존 `postcss.config.mjs` 경고 1 |
| `npm run build` | **Production Build 통과**. 최종 CSS 반영 후 재검증 |
| `npm run test:browser` | **실제 Chrome 42개 항목 통과**. 합성 HTTP 통합 검증도 함께 통과 |

별도의 `test:integration` 명령을 중복 실행하지 않았다. `test:browser`가 같은 HTTP 통합 harness를 실행한 후 Chrome을 실행한다. 결과 파일은 `.verification/member-auth-report.json`, `.verification/member-browser/report.json`이다.

검증 중 기존 현황 문구를 기대하던 테스트를 새 UI 문구로 갱신했다. 스트리밍 중 숨겨진 HTML 조각을 먼저 측정하던 브라우저 검증은 실제 표시된 목록을 기다리도록 보완했다. 최종 재실행에서 모두 통과했다.

## 11. 보호 범위와 운영 적용

- 시작 해시 대비 인증·API·DB·사진 압축·BOARD 편집/좋아요·발표 컴포넌트 등 보호 대상 120개 파일이 동일함을 확인했다. 삭제한 파일은 없다.
- 기존 CSS 원문은 유지했다. 실제 발표 슬라이드의 간격과 MDX 원본은 변경하지 않았다.
- DB migration, RLS, Storage 설정, 환경변수, 의존성 변경이 없다. 운영 DB/Storage에 요청하거나 테스트 데이터를 생성하지 않았다.
- GitHub push·Vercel 배포를 실행하지 않았다. 로컬 검증은 완료되어 코드 배포를 준비할 수 있다.
- 승인 후 기존 로컬 작업과 이번 UI 변경을 구분해 검토하고, 원격 최신 상태를 다시 확인한 뒤 안전한 커밋/배포를 진행한다. 루트의 이전 작업을 버리거나 강제 push하지 않는다.

## 12. 미완료·검증 범위의 한계

- Vercel/Linux 실제 배포와 운영 로그인 후 E2E는 이번에 실행하지 않았다.
- Safari/iPhone 실기기는 검증하지 않았다. 모바일 Chrome 에뮬레이션과 키보드 동작을 확인했다.
- HTTP 통합은 합성 PostgreSQL/Storage 응답을 사용했다. 실제 운영 DB 동시성·권한의 재검증으로 간주하지 않는다. 이번에는 해당 로직을 수정하지 않았다.
- 원본 쿠키의 OS 차원 브라우저 재실행 영속성은 기존 harness가 메모리 복원 방식으로 검증하므로, 실제 OS 재실행 테스트와 구분한다.
- 운영 제목·공지·사진의 실제 길이에 따른 화면은 배포 후 확인이 필요하다. 가짜 현황·후보지·수치는 운영에 추가하지 않았다.
