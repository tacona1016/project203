# 203 PROJECT 웹사이트 UX·기능 개선

2026-11-02. 직전 UI 개선을 보존하고 자주 사용하는 흐름을 확장했다. **로컬 코드 작업이며 push·운영 배포·DB 적용·환경변수·저장소 설정 변경은 하지 않는다.**

## 1. 현재 구조와 보존 기준

- Home/Archive/Polls/Board/Admin과 기존 URL을 유지한다. 발표자료는 Git+MDX, Poll·게시판은 서버 API+Supabase, 프로젝트 현황은 코드 설정이다.
- 원격 main/운영 배포는 시작 시 `584220b`, READY였다. 저장소는 Public이었다. 로컬 `.git`은 쓰기 제한으로 `ddd552e` 기준이며 이전 완료 작업이 dirty tree에 남아 있다. 초기화하거나 이전 변경을 새 기능으로 재배포하지 않는다.
- 이번 시작 파일 198개 해시는 `.verification/website-features-baseline.json`, 직전 인계는 `.verification/handoff-before-website-features.md`에 보관한다.
- 회원 30일/관리자 8시간 세션, 작성자 UUID, 서버 전용 DB 접근, RLS, `poll_choice_selections`/`submit_choice_ballot`, 결과 비공개·선택 변경 정책, 기존 MDX 본문·게시글·댓글을 유지한다.
- 이번 요청에서 제외한 인증·비밀번호·rate limit·성능/인덱스·백업/CI/CD 구축은 수행하지 않는다. 기본 반응형·입력 검증·회귀 테스트만 포함한다.

## 2. 기능별 상태

검증 완료는 로컬 합성 HTTP/Chrome 범위를 뜻하며 실제 운영·PostgreSQL 검증과 구분한다. 명령별 결과는 8절에 정리했다. 실제 상태·일정·후보·결정을 임의로 등록하지 않는다.

| 기능 | 상태 | 구현 범위 |
| --- | --- | --- |
| 기존 모바일 메뉴·BOARD 제한·Admin 한글/요약 | 구현 및 검증 완료 | 직전 작업을 유지하고 회귀 검사. 새로 만든 것으로 집계하지 않음 |
| HOME 현황·할 일·공지·로드맵 | 구현 및 검증 완료 | 미정 상태 유지, 공지 제목 3개, 최근/임박 투표, Q4 목표 3Phase. 합성 API와 Chrome 확인 |
| Archive 검색·연도 필터 | 구현 및 검증 완료 | 공개 metadata만 검색, 기존 발표 URL 유지. 검색/빈 상태 Chrome 확인 |
| 발표 목차·진행률·이동·전체화면·인쇄 | 구현 및 검증 완료 | 12장 목차·anchor·진행률·전체화면 Chrome 확인. PDF 생성/인쇄 스타일 확인, 전체 PDF 육안 검수 미수행 |
| Poll 필터·참여율·결과·복사 | 구현 및 검증 완료 | 진행/예정·본인 참여 분리, 득표순·동률·분모·선택 요약·복사 대체. API/Chrome 확인 |
| BOARD 본인 댓글 수정 | 사용자 승인 필요 | PATCH·수정/취소/시간 UI와 권한을 합성 API/Chrome 검증. 신규 RPC의 실제 PG 검증·운영 적용은 미완료 |
| BOARD 초안·NEW·목록 복귀·링크 | 구현 및 검증 완료 | opt-in·새로고침/명시 복원·취소·등록 후 해당 초안 삭제·다른 유형 초안 보존·검색 복귀·안전 링크 Chrome 확인 |
| Admin 현황·확인·필드 오류 | 구현 및 검증 완료 | 여섯 현황·공지 바로가기, 종료 취소/확인·재개, 제목/기간 오류·포커스 Chrome 확인 |
| 발표→투표→결정 연결 | 일부 구현 | 명시적 registry+실제 존재·공개 여부 검증. 실제 관계는 빈 배열이며 설정 전 미표시 |
| 공동 일정 | 일부 구현 | 코드 설정·미래 일정 최대 3개·시간대 검증·빈 상태. 실제 확정 일정 없음 |
| 후보지 비교 | 일부 구현 | 재사용 UI·타입·출처/미확인 값, 실제 배열은 비움. 등록/수정 DB·Admin CRUD는 만들지 않음 |
| 게시글 ‘프로젝트’ 분류·상태 관리 GUI | 설계만 완료 | 기존 general/notice 유지. 불필요한 DB/CMS 추가 보류 |
| 자금 현황·통합 검색 확장 | 설계만 완료 | 11절의 최소 데이터/권한/운영 설계. 금융정보 저장·계좌 연동 없음 |
| 회원별 읽음 알림 | 미진행 | 기존 조회로 최신 공지/투표·마감·NEW만 제공. 읽음 이력/알림 DB 없음 |

## 3. Before / After와 사용 방법

### HOME

이전에는 현황과 발표·투표 중심이었다. 이제 **간결한 소개 → 실제 현황 → 지금 할 일 → 투표 → 공지 → 최신 발표 → 목표 로드맵·확정 일정** 순서다. 합의되지 않은 단계·목표·다음 행동·날짜는 계속 미정이다.

로드맵의 2027–2028년 토지 구매, ~2030년 토목·인프라, ~2035년 별장 건축은 Q4 발표의 **목표 일정**이며 완료 상태나 확정 진행률이 아니다. 공지는 제목·고정 여부·작성일만 조회한다. 본문 전체를 Home/RSC props에 전달하지 않는다.

### Archive / 발표자료

- Archive에서 제목·설명·분기 검색과 연도 필터를 사용한다. 미공개 분기에는 발표 링크를 만들지 않는다.
- 발표 상단의 목차에서 구간을 선택한다. 현재 섹션/전체 장 수와 진행 막대는 활성 섹션 기준이며 읽은 이력은 저장하지 않는다.
- 이전/다음·맨 위·URL anchor를 사용한다. 버튼 이동은 관찰자의 중간 섹션 상태와 충돌하지 않도록 즉시 이동하고 일반 스크롤은 유지한다.
- 지원하는 데스크톱 브라우저에서 발표 모드(Fullscreen)를 사용한다. 방향키/PageUp·Down, 종료 버튼을 제공하고 지원/권한 실패 시 안내한다. 별도 엔진이나 슬라이드 복사본을 만들지 않았다.
- 브라우저 인쇄/PDF에서 탐색·댓글·관련 링크 UI를 숨기고 section별 페이지 분리, 가변 높이와 이미지 비율을 적용한다. 서버 PDF 생성기는 없다.

### Polls

- 상태: 전체/진행 중/예정/종료. 본인 참여: 전체/미참여/참여 완료. 기본 진행 중에는 예정 투표를 섞지 않는다.
- `status=active|upcoming|closed|all`, `participation=pending|done`를 사용하며 기존 `tab=closed`와 미참여 URL을 유지한다. 과거 분기의 활성 여부는 날짜·종료 설정만으로 결정한다.
- 참여율 분모는 현재 등록회원 전체(비활성 포함)다. 기존 분자는 역사적 참여자를 포함하므로 활성 회원만 분모로 사용하지 않는다. 분모가 없거나 범위가 맞지 않으면 비율을 단정하지 않는다.
- `after_close` 진행 중에는 결과·총 참여 수·참여율 분모를 전달하지 않는다. 본인 참여 여부/응답 확인과 Admin의 기존 전체 결과 권한은 유지한다.
- 선택형 결과는 원래 순서/득표순과 공동 1위를 표시한다. 단일은 유효 표, 복수는 참여자 기준 선택률이며 복수 비율 합은 100%를 넘을 수 있다.
- 복수선택 제출 전 목록과 개수를 보여주며 매번 확인 팝업을 강제하지 않는다. 서버 저장 확인 후에만 성공 안내·현재 선택·변경 정책을 보여준다. 응답 불확실 상태는 기존 본인 상태 확인과 제출 잠금을 유지한다.
- 링크 복사는 성공/실패 안내를 제공하며 Clipboard 권한이 없으면 읽기 전용 URL을 직접 복사한다. 링크를 공유해도 회원 인증은 필요하다.

### Board / Admin

- 본인 댓글만 내용 수정 가능하며 관리자의 기존 타인 댓글 삭제 권한은 유지한다. 수정 취소·저장·수정 시각·완료 안내를 제공한다.
- 본문 10,000/댓글 2,000/제목 160자는 기존 trim 후 Unicode codepoint 기준을 유지한다. 한글·기본 이모지·조합 문자·줄바꿈을 동일하게 검증한다.
- 기기 초안은 기본 꺼짐이다. 회원 UUID + 새 글/편집 ID + 일반/공지별로 분리하며 재접속 시 직접 불러온다. 성공 확인 후 해당 초안만 지우고 다른 종류 초안은 보존한다.
- 초안은 브라우저에 평문으로 저장된다. 공용 기기에서 켜지 말고 ‘임시저장 삭제’를 사용한다. 7일은 복원 만료이며 브라우저가 닫힌 동안 정확한 시각에 물리 삭제되는 것은 보장하지 않는다. 해당 화면 재접속 시 만료 데이터를 제거한다.
- NEW는 최근 7일 작성이며 미열람 표시가 아니다. 댓글 작성/수정 시각을 구분한다. 검색 q/page를 안전한 `/board` 복귀 링크에 유지한다.
- HTTP(S) 주소만 링크화하고 HTML/Markdown은 문자로 표시한다. 대형 편집기나 이미지 업로드는 없다.
- 관리자 첫 화면은 기존 catalog로 여섯 현황과 마감 예정 투표·공지 바로가기를 제공한다. 종료·재개·숨김 및 기존 설정 변경에는 필요한 한 번의 확인만 제공한다. 입력 오류는 필드 근처와 포커스로 안내한다.

## 4. 변경 파일

| 영역 | 파일 |
| --- | --- |
| HOME | `app/page.tsx`, `components/home/{ProjectTasks,LatestNotices,ProjectRoadmap,UpcomingEvents}.tsx`, `data/project-plan.ts`, `lib/board/notices.ts` |
| 발표/Archive | `components/presentation/{Presentation,Slide,Hero,PresentationNavigator}.tsx`, `app/archive/page.tsx` |
| Polls | `app/polls/{page,[slug]/page}.tsx`, `components/polls/*`, `components/interactive/{Poll,PollForm,PollResults}.tsx`, `components/CopyLink.tsx`, `lib/poll-view.ts`, `lib/supabase/{queries,types}.ts` |
| Board | `app/board/{page,new/page,[id]/page,[id]/edit/page}.tsx`, `components/board/{BoardEditor,BoardComments,BoardPostActions,BoardWriteLinks,BoardBody,BoardDraftTools}.tsx`, `lib/board/{data,draft,view,text}.ts`, `app/api/board/posts/[id]/comments/[commentId]/route.ts`: 댓글 편집·초안·안전 본문·목록 복귀·NEW |
| Admin | `app/admin/page.tsx`, `components/admin/{AdminWorkspace,AdminPollList,PollEditor}.tsx`: 현황·공지 이동·중요 변경 확인·필드별 오류 |
| 연결/후보 | `data/content-links.ts`, `components/RelatedContent.tsx`, `data/land-candidates.ts`, `components/project/LandComparison.tsx` |
| 스타일 | `app/globals.css` |
| SQL | `supabase/migrations/20261102000000_board_comment_edit.sql`, `supabase/tests/board_comment_edit.sql`: 신규 함수와 TEST 전용 검사 |
| 검증 | `tests/{board-draft,poll-view,project-plan,project-content}.test.mjs`, `tests/fixtures/{board-server,polls-server}.mjs`, `tests/integration/{website-features,presentation-polls-browser,board-workflow-browser,member-auth,member-browser,ui-ux-browser}.mjs` |
| 문서 | `README.md`, `docs/board.md`, 이 보고서, `docs/SESSION_HANDOFF.md` |

최종 정확한 변경 목록은 `.verification/website-features-changed-files.json`의 시작 시점 대비 목록을 따른다. 이전 미커밋 변경까지 포함하는 오래된 Git HEAD diff와 구분한다.

인증 모듈 전체·proxy·package/lock·quarter metadata·Q4 MDX·기존 migration은 시작 시점 해시와 동일함을 확인했다. 패키지 추가나 기존 파일 삭제는 없다.

## 5. 실제 자료 연결·일정·후보지 설정

- `data/content-links.ts`에 등록된 quarter, 실제 poll slug, 실제 결정 notice ID만 명시한다. 기본은 빈 배열이다. 서버는 미등록 분기·잘못된 ID·숨긴/없는 Poll·일반/삭제 게시글을 링크에서 제외한다. 자동으로 모든 공지를 최종 결정으로 해석하지 않는다.
- 발표 하단의 ‘이 분기의 투표’는 기존 quarter 분류로 이동하는 일반 링크다. 특정 발표 주제와 직접 연결되었다는 뜻이 아니다.
- `data/project-plan.ts`의 `projectEvents`에는 확정된 일정만 추가한다. 명시적인 시간대가 있는 ISO 시각과 안전한 내부 목적지를 사용한다. 다음 미래 일정 최대 3개를 한국 시간으로 표시한다. 기본은 빈 배열이다.
- `data/land-candidates.ts`의 후보 목록도 비워 두었다. 실제 확인한 후보를 등록하면 Home 하단의 비교 UI가 표시된다. 위치/가격/면적/접근/건축/도로/전기·수도·오수/지형/환경/추가 비용/확인 사항/확인일·출처를 구분한다. 미확인 금액은 생략하며 0으로 채우지 않는다.
- 모든 예시는 로컬 fixture 복사본에만 주입한다. 운영 DB에 가짜 공지·후보·일정·최종 결정을 등록하지 않는다.

## 6. DB 변경과 승인·롤백

새 테이블·컬럼·인덱스·정책은 없다. 기존 `board_post_comments.updated_at`와 trigger를 사용하고 **댓글 수정용 함수 하나만 추가**한다.

`edit_board_comment(p_post_id bigint,p_id bigint,p_actor_id uuid,p_content text)`는 부모 게시글→활성 회원→댓글을 잠그고 유효 본문/삭제 상태/본인 작성자를 확인한다. 관리자가 다른 회원의 말을 바꾸지 못하게 하며 기존 삭제 권한과 분리한다. `SECURITY INVOKER`, 빈 search_path, public/anon/authenticated 실행 회수와 service_role EXECUTE만 사용한다.

순서:

1. 기존 DB schema·권한과 신규 SQL을 검토한다. `supabase db push`, 기존 schema/seed/migration 일괄 실행은 금지한다.
2. 별도 TEST DB에 신규 migration을 적용한 다음 `supabase/tests/board_comment_edit.sql`의 TEST 확인 주석을 검토·해제하고 실행한다. 본인/타인/비활성/삭제/길이/Unicode/시각·권한을 검사하고 ROLLBACK한다. sequence 증가는 롤백되지 않아 TEST DB에도 번호 간격이 남을 수 있다. 현재 로컬 PG/CLI가 없어 SQL 실행과 실제 DB 동시성은 미검증이다.
3. 사용자 승인 후 **신규 SQL 파일만** Supabase SQL Editor에서 BEGIN~COMMIT 전체 실행한다. 기존 데이터는 수정하지 않는다.
4. 승인된 Preview에서 댓글·기존 기능을 확인한 뒤 별도 승인으로 앱을 배포한다. 환경변수 추가는 필요 없다. 이번 작업은 여기까지 운영 실행하지 않았다.
5. 롤백은 기존 canonical 투표 구조와 호환되는 직전 앱으로 돌아간다. 신규 함수는 미사용 상태로 남겨도 되며 행 삭제/DB 복원은 필요 없다. 실제 사용자가 수정한 댓글을 임의의 예전 내용으로 덮어쓰지 않는다.

## 7. 보존·노출 위험

현재 저장소가 Public이므로 사이트 로그인과 별개로 추적한 MDX·코드 설정·이미지·문서를 GitHub에서 읽을 수 있다. 향후 실제 후보지나 공동 일정 정보를 코드에 넣기 전에 공개 범위를 검토해야 한다. Private 전환과 기존 fork/clone 회수 문제는 별도 승인 항목이며 이번에 설정을 바꾸지 않았다.

인증/비밀번호 정책·세션·RLS·투표 저장/원본 데이터·기존 MDX 본문은 변경하지 않는다. 기기 초안은 인증 근거가 아니며 작성자 ID는 계속 서버 회원 세션에서 결정한다.

## 8. 테스트와 실제 검증 범위

실제 운영 회원·비밀번호·데이터를 사용하지 않고 로컬 합성 fixture로 검증했다.

| 명령 | 결과 | 범위 |
| --- | --- | --- |
| `npm test` | 통과: 60/60, 실패·skip 0 | 직전 47개 + 이번 13개. 기존 인증/권한/투표 검사 유지 |
| `npm run typecheck` | 통과 | Next route typegen + strict tsc |
| `npm run lint` | 오류 0, 기존 경고 1 | 기존 postcss.config.mjs anonymous default export 경고. 불필요한 설정 변경 생략 |
| `npm run build` | 통과 | 공개 metadata/MDX 검증 + Next 16.4.2 프로덕션 빌드 |
| `npm run test:integration` | 통과 | 회원/관리자·투표·새 댓글 PATCH/공지/관련 링크/비공개 결과의 보호된 API. HTTP 프로토콜 fixture이며 실제 PostgreSQL 아님 |
| `npm run test:browser` | 통과 | 실제 headless Chrome + 합성 HTTP DB. 아래 화면·상호작용 검증 |
| `npm run test:production` | 통과 | 별도 로컬 fixture 프로덕션 build/start + API 회귀. Vercel 운영 테스트가 아님 |

Chrome 검증:

- 기존 화면의 320/390/430/768/1440px 메뉴·레이아웃·가로 overflow 및 키보드/ESC/외부 클릭/경로 이동 닫기를 회귀 확인했다.
- 새 발표 탐색은 390/768/1440px 및 가로 844×390에서 목차·12장 anchor·진행률·이전/다음/맨 위를 확인했다. 전체화면 진입·키보드 이동·종료도 확인했다.
- Archive 검색/연도/빈 결과, Poll 진행/예정/전체/본인참여/구 URL 필터, 득표순·동률·분모 설명, 링크 복사/권한 거절 대체, 복수선택 요약과 비공개 집계 미노출을 확인했다.
- Board 본인 댓글 수정 취소/저장·시각·안내, 초안 opt-in/새로고침·명시 복원·취소·등록 후 정리·별도 공지 초안 보존, 검색/페이지 복귀·NEW·안전 링크를 확인했다.
- Admin 여섯 현황과 공지 링크, 종료 취소/확인·재개, 제목/역전 기간 오류·포커스·잘못된 폼 미등록을 확인했다.
- 기존 로그인/자동완성/Enter/두 탭 로그아웃·세션·단일/복수선택·선택 변경·주관식·응답 불확실 복구·관리자 공지/권한 검사도 통과했다.

산출물은 Git 제외 `.verification/member-browser/`에 PNG와 `report.json`으로 남겼다. `feature-presentation.pdf`는 웹 12섹션을 출력해 생성했으며 긴 본문은 여러 A4 페이지에 흐른다. 인쇄 UI 숨김·가변 높이·이미지 비율은 확인했지만 모든 PDF 페이지를 육안 검수한 것은 아니다. 실기기 iPhone Safari/WebKit, OS의 실제 쿠키 디스크 유지와 운영 배포 E2E는 미검증이다.

검사 중 확인·수정한 문제:

- 발표 anchor의 scroll-padding/scroll-margin 중복으로 이전 이동이 틀어짐 → 단일 offset과 즉시 이동으로 정리했다.
- 저장 후 pagehide가 초안을 재생성하거나 다른 종류 초안까지 삭제할 가능성 → 서버 ACK ref와 해당 scope만 정리한다.
- 저장 응답 전 이탈 경고가 사라짐 → ACK 전 경고를 유지한다.
- hydration 전 결과 정렬/복사 조작 → 준비 전 비활성화한다.
- 테스트의 이전 문서 측정·준비 상태 대기와 정규식 문자열 오류도 앱 문제와 구분해 수정했다.

새 SQL은 스키마·권한·본문을 읽기 검토하고 TEST 전용 검사를 작성했지만 **실제 PostgreSQL에서 실행하지 않았다**. 합성 동시 요청 통과를 실제 DB 동시성 검증으로 보고하지 않는다.

## 9. 운영 적용 필요 작업

- 신규 댓글 함수 SQL 검토·별도 TEST DB 검증·운영 승인
- 코드 검토 후 승인된 GitHub 반영·Preview·Production 배포
- 실제 관계·확정 일정·후보지를 사용자가 코드에 등록하는 경우 공개 저장소 위험을 먼저 검토
- 환경변수 변경·회원 비밀번호 변경·기존 migration 재실행은 필요 없음

## 10. 아직 구현하지 않은 범위

- 실기기 iPhone Safari/WebKit, 운영 배포 E2E, 실제 PostgreSQL 신규 함수·동시성 검증
- Board의 추가 ‘프로젝트’ DB 분류, GUI 프로젝트 상태 변경, 후보지/일정 관리 DB·관리 화면
- 개인별 읽음 이력, 이메일/Push, 금융계좌·송금·결제, 자금 DB, 전역 전문 검색
- 실시간 채팅·프로필 사진·다크모드·좋아요·공개 SEO·오프라인 PWA

## 11. 후속 설계

### 자금 현황

합의한 목표 금액, 총 적립, 지출 합계/용도 요약, 잔여 필요 금액, 기준일, 기록자·확인자를 한 스냅샷으로 관리하는 것을 우선한다. 실제 수치가 없어 이번 화면에 금액·진행률을 표시하지 않는다. 계좌번호/개인별 입금·민감한 금융정보는 범위에 넣지 않는다. 정식 데이터화 시 관리자 입력과 별도 확인 주체를 정하고 변경 이력을 설계한다.

### 분류·검색·알림

‘프로젝트’ 분류가 필요하면 공지 권한용 post_type과 독립된 category를 검토한다. 기존 값은 general 기본으로 보존하고 CHECK·검색·권한 영향과 별도 migration을 먼저 검증한다. 지금은 general/notice를 그대로 쓴다.

현재 Archive 검색·Poll 상태/참여 필터·Board 제목/본문 검색을 유지한다. 자료가 늘면 인증된 서버에서 공개 발표 metadata, 볼 수 있는 Poll 제목, Board 검색을 묶는 단순 검색부터 검토한다. 별도 검색 인프라는 도입하지 않았다.

Home의 최근 공지·투표·마감과 Board NEW는 간단한 최신 소식 역할만 한다. 읽음 여부나 사용자가 확인한 알림 개수를 추정하지 않는다. 개인 읽음 이력이 필요할 때만 데이터 보존·분량·권한을 별도 설계한다.
