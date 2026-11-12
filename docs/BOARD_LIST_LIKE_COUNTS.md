# BOARD 목록 좋아요 수

2026-11-12. 현재 Production main c74edc6를 기준으로 기존 댓글 수와 함께 게시글 좋아요 수를 표시한다. **Production 배포는 별도 승인 대기**이며 DB 데이터/권한/migration을 변경하지 않는다.

## 조회 방식

1. 기존 get_board_page RPC로 검색·페이지·고정 공지를 그대로 조회한다.
2. 현재 페이지 일반 글과 고정 공지 ID를 중복 제거한다.
3. 같은 서버 전용 클라이언트로 board_post_likes의 **post_id만** IN 배치 조회한다. 회원 ID/이름은 선택하지 않고 get_board_engagement를 글마다 호출하지 않는다.
4. 서버 메모리에서 post_id별 행 수를 세어 like_count로 결합한다. 기존 BoardPage 메타데이터와 순서를 유지한다.

**추가 DB HTTP 요청은 목록당1회**, 글/고정 공지가 모두 없으면0회다. 기존 목록RPC와 별도이며 인증 확인 등의 기존 요청 수를 뜻하지 않는다. 기존 복합PK(post_id,participant_id)로 IN 범위를 찾는다. 읽기 확인 당시 회원10명·게시글좋아요3개로 단일 배치가 충분했다. 비활성 회원의 과거 좋아요도 상세 화면의 기존 count와 동일하게 포함하며 데이터를 재할당하지 않는다.

PostgREST의 응답 행 한도에서 결과가 잘릴 수 있어 count:exact와 받은 행 수를 비교한다. count 누락·잘림·예상 밖 post_id·조회 오류이면 전체 배치 count를 null로 두고 과소집계하지 않는다. 대량의 고정 공지나 회원 수 증가로 한도를 넘으면 향후 별도 집계 RPC를 검토한다. 이번에는 추가 pagination DB 요청·설정 변경·새 RPC/인덱스를 만들지 않는다. [Supabase select/count](https://supabase.com/docs/reference/javascript/select)

## 0과 실패 구분

- 정상 조회·좋아요 없음: like_count=0, `♡ 0`.
- 실패/불완전한 응답: like_count=null, `♡ —`, 스크린리더/툴팁에 확인 불가 안내.
- 좋아요 조회만 실패하면 기존 글 목록·댓글 수·검색·페이지네이션·고정 공지는 유지한다.
- 목록 자체의 기존 RPC 실패 처리는 변경하지 않는다. 실제 비밀키/참여자 목록은 응답하지 않는다.

## UI와 최신화

댓글과 하트 숫자를 기존 board-row-meta 안에 정렬한다. 하트는 상세 버튼과 같은 ♡ 모양이며 목록에서는 버튼이 아닌 span이다. `좋아요 N개` / `댓글 N개` 레이블을 구분했다. 제목의 ellipsis, 공지/NEW, 작성자/날짜와 전체 행의 상세 링크를 유지한다. author는 공간이 부족하면 말줄임하고 숫자는 줄바꿈하지 않는다. CSS는 Board 행으로 한정했다.

서버 DB fetch는 기존 no-store를 유지한다. 상세의 게시글 좋아요만 서버 ACK 또는 실패 후 GET 상태 재확인을 받았을 때 router.refresh한다. 설치된 Next16.4.2의 refresh는 dynamic back/forward 캐시를 무효화하므로 뒤로가기/목록 Link 재진입 시 최신 count를 조회한다. 주기적 polling·새 mutation API·댓글 좋아요 갱신 흐름은 추가하지 않았다. 기존 낙관적 표시·중복 클릭 잠금·실패 복구는 유지한다.

## 변경 파일

- app/board/page.tsx, app/globals.css: 댓글/좋아요 메타 표시·행 전용 스타일.
- lib/board/data.ts, list-likes.ts, types.ts, lib/supabase/types.ts: 서버 배치/안전 집계/목록 필드/기존 테이블 타입. DB 스키마 변경 아님.
- components/board/BoardLikeButton.tsx: 게시글 좋아요 ACK 이후 정상 캐시 갱신.
- tests/board-list-likes.test.mjs:0/1/여러개·고정/일반·큰ID·잘림/실패·페이지 메타 보존.
- tests/fixtures/board-extras.mjs, tests/integration/board-list-likes.mjs, board-list-likes-browser.mjs, member-auth.mjs, member-browser.mjs: 단일 배치 요청 수/필드/범위, 검색/페이지, 변화·장애·모바일·행 클릭 회귀.
- docs/SESSION_HANDOFF.md 및 이 문서: 결과/운영 적용 상태.

## 검증 상태

- 단위95/95, typecheck, lint(오류0·기존경고1), Production Build(conflict/presentation 포함) 통과.
- 최초 build/dev 실패는 검토repo의 외부 node_modules junction 때문이었다. 같은 잠금 의존성을 project 내부 hardlink/copy로 준비해 해결했으며 package/Next 설정/검사를 바꾸지 않았다.
- 합성 HTTP23검사 PASS. 현재 페이지+고정 공지 조회 범위·추가1요청(빈 목록0)·참여자 ID 비노출·0/1/여러개·검색/페이지·실패/잘림 처리 확인.
- Production build/start + 실제 Chrome 집중 검사 PASS(합성 DB/Storage):390/768/1440, 전체 행 클릭·제목 말줄임·count/미확인 표시, 좋아요 추가 후 history.back 및 취소 후 목록 Link의 최신 count·검색 유지. 예외0/hydration0. 행 높이 모바일75.5px·태블릿/PC51.5px, 가로 넘침 없음.
- 최초 화면 실패는 숨은 스트리밍 DOM의 폭0을 읽은 검사 문제였다. 화면에 표시된 행만 기다리도록 보완했다. 개발 서버 HMR 초기 구간의 404/로그인 fixture 재로딩도 관찰하여 기능 집중 검사는 Production 모드로 구분했다. 기본 전체 브라우저 검사는 재실행 중이며 결과/PR/Preview를 아래에 갱신한다.
- 최종 `npm run test:browser`도 **Chrome45그룹+합성 HTTP24검사 PASS**, 예외0/hydration0. 브라우저 재시작의 OS 쿠키 영속성은 기존 fixture 방식(합성 쿠키 메모리 복원)으로 분리되며 실기기 보증이 아니다. 스크린샷은 ignore된 .verification/member-browser/board-list-likes-{390,768,1440}.png, measurements JSON에 보관한다. 실제 캡처를 확인했다.
- 이번 변경으로 기존 인증·관리자·댓글/공지·투표·이미지/500KB 압축·발표자료 관련 회귀 검사도 통과했다. 앱/API/SQL/패키지 삭제0, 기존 SQL·좋아요 mutation API·이미지 코드·회원 데이터 변경0.
- 실제 PostgreSQL은 기존 PK/권한/전체 행 개수의 읽기 확인만 했다. 독립 TEST가 없으므로 신규 앱의 실제 DB/운영 회원 E2E·실제 좋아요 변경은 미검증이다. 운영 데이터에 테스트 행을 쓰지 않았다.

## 배포

기능 branch feat/board-list-like-counts-20261112에서 코드·테스트만 관리한다. root의 이전 인계/릴리스 문서와 PR#1을 덮어쓰지 않는다. 원격 main이 실제 배포 c74edc6와 같고 검토 repo의 시작 tree가 동일함을 확인했다. 로컬 Git 네트워크가 막혀 있어 연결 GitHub 도구로 최신 main을 부모로 하는 신규 commit/tree를 검증해 전송한다. main 병합/Production 배포는 하지 않는다.

DB migration·신규 환경변수는 필요 없다. PR CI/Preview 검증 후 사용자 승인을 받아 정상 병합하면 Git 연동 Production에 반영할 수 있다. 앱 이전 버전으로 되돌려도 기존 좋아요 저장 데이터에 영향이 없다.
