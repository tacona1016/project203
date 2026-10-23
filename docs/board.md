# BOARD 운영과 배포

## 적용 범위

- `/board`: 고정 공지, 최신 글, 제목·본문 검색, 일반 목록 10건 페이지네이션
- `/board/new`, `/board/[id]`, `/board/[id]/edit`: 작성·상세·수정
- 모든 글과 공지의 댓글: 작성·작성자/관리자 삭제, 30건씩 더 보기
- 글과 댓글 삭제는 `deleted_at`만 기록하는 soft delete다. 기존 Poll/분기 댓글/참가자 데이터는 변경하지 않는다.
- 일반 작성자는 본인 확인 후 자신의 일반 글만 관리한다. 관리자는 공지·고정·일반/공지 전환과 전체 글·댓글을 관리한다. 댓글 수정과 파일 첨부는 없다.

## 주요 파일

| 경로 | 역할 |
| --- | --- |
| `app/board/` | 목록·작성·상세·수정과 BOARD 전용 Provider boundary |
| `app/api/board/` | 본인 확인·게시글·댓글 API |
| `components/board/` | 본인 확인, 작성 폼, 수정/삭제, 댓글 UI |
| `lib/board/` | 타입, 입력 검증, 목적별 DB 작업과 브라우저 요청 |
| `lib/auth/board-session.ts`, `board-token.ts` | 개인 비밀번호 확인과 30일 BOARD 서명 쿠키 |
| `lib/site-images-config.ts`, `lib/private-assets.ts` | 이미지 허용 목록과 파일 검사 |
| `app/api/site-images/[key]/route.ts`, `components/PrivateSiteImage.tsx` | 인증된 이미지 응답과 Server Component |
| `supabase/migrations/20261023040000_board.sql` | 신규 BOARD 테이블·권한·RPC |
| `tests/board.test.mjs`, `supabase/tests/board.sql` | 입력·서명·이미지·DB 권한 회귀 시험 |

기존 파일은 `components/SiteNav.tsx`, `components/SitePage.tsx`, `app/page.tsx`, `app/globals.css`, `app/api/access/lock/route.ts`, `lib/auth/participant-session.ts`, `lib/supabase/types.ts`, `next.config.mjs`, `.env.example`, `.gitignore`, `README.md`를 수정했다. Poll/Archive/Presentation의 원본과 기존 DB 데이터는 변경하지 않았다. 신규 npm dependency는 없다.

## 게시판 본인 확인

사이트 공용 비밀번호와 이름 선택만으로 실제 작성자를 확인할 수 없다. BOARD에서는 개인 비밀번호를 추가 확인한다. 기존 사이트 인증·투표·분기 댓글의 동작은 바꾸지 않는다.

서버 전용 `BOARD_PARTICIPANT_PASSWORDS`는 **participant UUID → 게시판 비밀번호**의 JSON 객체다. 관리자가 참여자별로 최소 10자, 권장 16자 이상의 비밀번호를 정해 전달한다. 여러 사람에게 같은 비밀번호를 지정해도 된다. 이름 대신 UUID를 쓰므로 이름을 바꿔도 작성자가 유지된다. 실제 값은 문서·Git·브라우저 번들에 기록하지 않는다. `.env.local`과 Vercel의 Secret 환경변수에만 저장한다. 예시는 실제 UUID와 값으로 교체해야 하는 형식 설명이다.

```env
BOARD_PARTICIPANT_PASSWORDS='{"<participant UUID>":"<게시판 비밀번호>"}'
```

미설정·짧은 값·앞뒤 공백이 있는 비밀번호는 해당 사용자의 BOARD 본인 확인을 허용하지 않는다. 중복 비밀번호는 허용한다. 읽기는 기존 사이트 인증으로 가능하다. 개인 확인 후 30일 HttpOnly/Secure(production)/SameSite=Lax 쿠키를 사용하며, 현재 사이트 세션과 participant에 서명으로 연결한다. 이름을 바꾸면 기존 확인 쿠키를 다른 participant의 증명으로 사용할 수 없고, 사이트를 잠그면 쿠키가 삭제된다. 개인 비밀번호 교체 후 재배포하면 해당 사용자의 BOARD 세션이 무효화되고, `SITE_SESSION_SECRET` 교체는 전체 세션을 무효화한다.

미확인 회원의 비밀번호 입력칸은 설정 오류가 있어도 표시한다. 선택한 사람의 설정 상태만 비밀 값 없이 안내하며, 길이·공백·JSON 형식 오류는 서버에서 계속 거부한다. 입력칸 표시만으로 작성 권한을 부여하지 않는다.

관리자는 기존 `ADMIN_PASSWORD`와 관리자 쿠키로 전체 글을 관리하며 개인 비밀번호를 추가 요구하지 않는다. 작성자 표시를 위해 활성 participant 선택은 필요하다. 모든 API는 서버에서 선택된 UUID와 관리자 세션을 읽는다. 요청 본문에는 author/participant/role/is_admin을 받지 않는다. UI 버튼은 편의 기능이며 권한 판단은 API와 DB 함수가 수행한다.

이는 비밀번호 소지 확인이다. 같은 비밀번호를 설정한 사람끼리는 이름을 바꾸고 그 비밀번호로 다시 확인하면 서로의 작성 권한을 사용할 수 있다. 같은 브라우저 세션을 공유하는 경우도 실제 신원을 보장하지 못한다. 관리자 공지 권한에는 기존의 별도 ADMIN_PASSWORD 검증이 계속 필요하다. 계정·회원가입·Supabase Auth는 추가하지 않았다. 개인 비밀번호 확인은 사이트 인증 뒤에만 허용되며, 배포 환경에서는 기존 사이트와 마찬가지로 요청 빈도 제한을 운영 정책에 맞게 설정할 수 있다.

## DB

운영 DB를 읽기 전용으로 검사했으며 기존 5개 테이블은 RLS가 켜져 있고 anon SELECT/INSERT가 차단되어 있다. Supabase Dashboard SQL Editor에서 **`supabase/migrations/20261023040000_board.sql`만 전체 실행**한다. 새 테이블 `board_posts`, `board_post_comments`, 최소 인덱스, CHECK/FK, 서버 전용 RPC·권한을 추가한다. 기존 테이블과 행을 수정·삭제하지 않는다. 같은 SQL을 재실행할 수 있다. 운영 DB에는 이 작업 중 자동 적용하지 않는다.

RPC는 `security invoker`, 빈 `search_path`, `service_role` 실행 권한만 사용한다. 브라우저 역할은 신규 테이블과 RPC에 직접 접근하지 못한다. 관리자 여부는 검증된 Next.js 서버만 RPC에 전달한다. 사용자가 body에 is_admin을 넣어 권한을 얻을 수 없다. 글 수정·삭제·댓글 등록/삭제는 DB에서 현재 행을 잠그고 다시 권한/삭제 여부를 검사한다.

`supabase/tests/board.sql`은 TEST DB에서만 실행한다. SQL의 fixture는 transaction 끝에서 rollback된다. 운영 DB에서는 테스트용 신규 행도 만들지 않는다.

## 배포

1. SQL을 검토하고 SQL Editor에서 실행한다.
2. `.env.local` 및 Vercel Production/필요한 Preview에 `BOARD_PARTICIPANT_PASSWORDS`를 서버 Secret으로 설정한다. 기존 5개 환경변수는 유지한다.
3. `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run build`를 실행한다.
4. 변경을 commit/push한다. 기존 Vercel Git 연동으로 배포한다. 환경변수만 바꾼 경우 최신 Production 배포를 Redeploy한다.
5. 사이트 입장 → 이름 선택 → BOARD 개인 확인 → 일반 글/댓글 → 관리자 인증 → 공지 작성/전환/고정을 확인한다.

개인 사진 추가·GitHub 공개 여부 확인·보호된 이미지 제공 방법은 `private-assets/README.md`를 따른다. 코드 변경과 이미지 포함 빌드를 로컬에서 검증해도 실제 Vercel 배포 URL 검증을 대신하지는 않는다.
