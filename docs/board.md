# BOARD 운영

## 인증과 작성자

사이트 회원 로그인(이름 + 개인 비밀번호)으로 BOARD도 이용합니다. 별도 게시판 비밀번호와 자유로운 이름 변경 기능은 없습니다. `BOARD_PARTICIPANT_PASSWORDS`는 이름을 유지한 사이트 전체 회원 비밀번호 매핑입니다. 회원 세션과 관리자 추가 인증은 [member-auth.md](member-auth.md)를 따릅니다.

모든 글·댓글의 author_id는 검증된 서버 회원 세션에서 결정합니다. 요청의 author_id, participant_id, role, is_admin을 신뢰하지 않습니다. 게시판 세션 GET은 권한 표시만 제공하며 예전 POST 추가 인증은 410으로 종료합니다.

## 권한과 기능

- `/board`: 고정 공지, 최신 글, 제목·본문 검색, 10건 페이지네이션
- `/board/new`, `/board/[id]`, `/board/[id]/edit`: 작성·상세·수정
- 일반 글: 로그인 회원 누구나 작성, 작성자·관리자만 수정/삭제
- 공지·고정·일반/공지 전환: 회원 로그인과 별도 관리자 인증 모두 필요
- 모든 글의 댓글: 회원 작성, 작성자·관리자 삭제, 30건씩 더 보기
- 삭제는 deleted_at만 기록하는 soft delete
- 파일 첨부·웹 사진 업로드·댓글 수정은 지원하지 않음

작성자·공지 권한은 API와 기존 DB RPC에서 검사합니다. Supabase Secret Key는 서버 전용이며 브라우저 직접 접근 권한과 RLS를 완화하지 않습니다. 기존 participants, polls, votes, comments, board_posts, board_post_comments를 그대로 유지합니다.

## 관련 파일

- `app/board/`, `components/board/`: 화면과 권한 표시
- `app/api/board/`: 글·댓글 API
- `lib/auth/board-session.ts`: 공통 회원 세션으로부터 게시판 작성자·관리자 권한 결정
- `lib/board/`: 입력 검증·타입·DB 작업
- `supabase/migrations/20261023040000_board.sql`: 기존 게시판 스키마 이력
- `supabase/tests/board.sql`: 별도 TEST DB에서만 실행할 DB 권한 회귀 검사

회원 인증 통합을 위해 DB SQL을 다시 실행할 필요는 없습니다. 운영 DB에 기존 schema·seed를 재실행하지 마세요.

## 이미지와 검증

디자인 사진은 VSCode에서 `private-assets/site/board/banner.jpg`에 추가하고 코드와 함께 배포합니다. [이미지 관리 문서](../private-assets/README.md)를 확인하세요. 파일이 없으면 기본 디자인을 표시합니다.

`npm.cmd test`, `npm.cmd run test:integration`, `npm.cmd run test:browser`, lint·typecheck·build로 검증합니다. 통합 검사는 가짜 로컬 DB 프로토콜을 사용하며 실제 운영 데이터는 변경하지 않습니다.
