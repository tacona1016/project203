# 203 PROJECT

친구 10명이 이용하는 비공개 프로젝트 사이트입니다. Next.js 16 App Router, TypeScript, Tailwind CSS, MDX, Supabase와 Vercel을 사용합니다.

## 로컬 실행

Node.js 22 이상과 npm을 사용합니다. PowerShell에서 npm이 차단되면 npm.cmd를 사용합니다.

```powershell
npm.cmd ci
npm.cmd run dev
```

http://localhost:3000 에서 이름과 개인 비밀번호로 로그인합니다. `.env.example`을 참고해 `.env.local`을 직접 설정합니다. 실제 비밀번호와 키는 Git에 저장하지 않습니다.

## 인증과 환경변수

| 변수 | 구분 | 역할 |
| --- | --- | --- |
| `SITE_SESSION_SECRET` | 서버 비밀 | 회원·관리자 세션의 목적별 서명 키 |
| `BOARD_PARTICIPANT_PASSWORDS` | 서버 비밀 | 기존 이름을 유지한 UUID → **사이트 회원 비밀번호** JSON 객체 |
| `ADMIN_PASSWORD` | 서버 비밀 | 로그인한 회원의 관리자 추가 인증 |
| `SUPABASE_SECRET_KEY` | 서버 비밀 | 서버 전용 Supabase 접근 |
| `NEXT_PUBLIC_SUPABASE_URL` | 공개 설정 | Supabase 프로젝트 URL |

로그인은 활성 participant의 UUID와 개인 비밀번호를 서버에서 검증합니다. 회원 세션은 30일, 관리자 추가 인증은 8시간 유지합니다. 비밀번호는 설정된 문자열과 정확하게 비교하며 공백·특수문자를 제거하지 않습니다. 비밀번호 매핑은 10~1024자의 문자열을 사용합니다. 사용자에게는 로그인 실패 원인을 일관되게 안내하고 서버 로그에는 원인 코드만 남깁니다.

이전 공용 사이트·이름 선택·게시판 쿠키와 localStorage는 인증에 사용하지 않습니다. 로그인 후 이름을 자유롭게 변경할 수 없고, 다른 회원으로 전환하려면 로그아웃 후 다시 로그인해야 합니다. 투표자·댓글·게시글 작성자와 본인 참여 조회의 UUID는 서버 세션에서 결정합니다. 관리자 인증은 특정 회원 로그인에 연결되어 다른 회원이나 재로그인 세션으로 이어지지 않습니다.

회원 비밀번호 변경·매핑 제거·회원 비활성화는 이후 보호 요청부터 기존 세션을 거부합니다. 전체 세션을 무효화하려면 SITE_SESSION_SECRET을 변경하고 재배포합니다. 쿠키는 HttpOnly, SameSite=Lax, Path=/, production Secure이며 보호 응답은 공유 캐시하지 않습니다.

같은 비밀번호도 허용하지만, 그 비밀번호를 아는 사람이 해당 이름들로 로그인할 수 있습니다. 실제 운영에서는 회원마다 서로 다른 비밀번호를 사용해야 합니다. 회원가입이나 Supabase Auth는 추가하지 않습니다.

자세한 설계·테스트·운영 전환·롤백: [docs/member-auth.md](docs/member-auth.md).

## 주요 구조

- `app/`: HOME, ARCHIVE, POLLS, BOARD, ADMIN 및 서버 API
- `app/quarter/<slug>/page.mdx`: 분기별 발표자료
- `components/presentation/`: 재사용 MDX 컴포넌트
- `components/interactive/`: 투표·결과·발표 댓글, 로그인 회원 표시 Context
- `components/access/`: 회원 로그인, 관리자 인증, 로그아웃
- `lib/auth/`: 회원 자격 검증, 서명 세션, 관리자 권한
- `lib/supabase/`: server-only 클라이언트, 조회·등록과 타입
- `lib/board/`, `components/board/`: 게시판·공지·댓글·작성자 권한
- `data/quarters.ts`: Home·Archive·Polls·Admin이 공유하는 분기 메타데이터
- `supabase/migrations/`: 기존 데이터를 보존하는 DB 변경 이력
- `tests/`: 단위 테스트, 가짜 DB 프로토콜 fixture, 로컬 HTTP·브라우저 통합 검사

## 분기 Presentation 추가

1. `app/quarter/2027-q1/page.mdx`를 추가합니다. 기존 Q4 파일과 Presentation 컴포넌트를 참고합니다.
2. `data/quarters.ts`에 slug, year, quarter, title, description, publishedAt 메타데이터를 등록합니다.
3. 공개 발표 이미지가 있으면 `public/images/2027-q1/`에 넣습니다.
4. build 후 Home의 최신 자료, Archive 링크와 모바일을 확인합니다.

Presentation 내용은 Git + MDX로 관리하며 DB에 넣지 않습니다. 최신 등록 분기를 Current로 사용합니다. 현재 Q4는 12장과 하단 발표 댓글로 구성됩니다.

## Polls와 Admin

Poll은 분기별로 분류하고 `/polls`에서 Current, `/polls/<quarter>`에서 해당 분기를 표시합니다. 과거 Quarter라도 기간·is_closed 조건에 따라 계속 참여할 수 있습니다.

회원 로그인 후 ADMIN에서 별도 관리자 비밀번호를 입력합니다. Create Poll에서 Quarter, 객관식/주관식, 제목, 선택지 또는 응답 길이, 결과 공개 시점과 투표 기간을 설정합니다.

- 객관식: single/multiple, single에서 선택 변경 허용
- 주관식: 1인 1응답, 허용할 때 기존 응답 수정, 최대 10~5000자
- live: 진행 중 결과 공개
- after_close: 수동 종료 또는 기간 만료 전 집계·참여 수·전체 응답을 서버에서 숨김; 본인의 응답만 별도 조회
- Close/Reopen, Hide/Unhide를 지원하며 삭제 UI는 없습니다.
- 투표 기간은 한국 시간으로 입력하고 DB 시각으로 검증합니다.

BOARD 일반 글은 작성자와 관리자만 관리하며 공지·고정·전환은 관리자만 가능합니다. 별도 게시판 비밀번호 입력은 없습니다. [게시판 운영 문서](docs/board.md)를 참고하세요.

## DB와 이미지

이번 회원 인증 통합에는 **DB migration이나 seed 재실행이 필요 없습니다.** 기존 participant UUID, 투표, 댓글, 게시글, RLS와 서버 전용 RPC를 유지합니다. 운영 DB에서 schema/seed/과거 migration을 반복 실행하지 마세요. 기존 설치 SQL과 TEST DB 회귀 SQL은 `supabase/`에 보관합니다.

개인 사진은 `private-assets/site/home`, `board`, `shared`에 개발자가 직접 넣습니다. 파일이 없어도 동작합니다. 인증된 이미지 Route Handler만 사진을 제공합니다. 웹 업로드·Storage·이미지 DB는 없습니다. [이미지 관리 방법](private-assets/README.md)을 따르세요.

## 검증

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:integration
npm.cmd run test:browser
npm.cmd run test:production
```

단위 테스트는 Node 기본 runner를 사용합니다. 통합 검사는 운영 DB·비밀번호를 사용하지 않고 소스 복사본과 가짜 Supabase HTTP 서버를 사용합니다. 3100/3102/3103 포트가 비어 있어야 합니다. 브라우저 검사는 Chrome이 필요하며 필요하면 BROWSER_BIN으로 실행 파일을 지정합니다. 결과·사진은 Git에서 제외된 `.verification/`에 저장됩니다. 실제 PostgreSQL/RLS 검증과 Vercel 배포 검증을 대신하지 않습니다.

## Vercel 반영

새 버전 검토·테스트 → Preview에서 개인 회원 로그인 확인 → 승인 후 Production 반영 순서로 진행합니다. 현재 작업은 운영 DB 변경·배포·main 병합을 하지 않습니다. 필수 환경변수 5개는 위 표와 같으며 이름을 바꾸거나 비밀번호를 초기화하지 않습니다.

SITE_ACCESS_PASSWORD는 새 버전이 동작하는지 확인할 때까지 Vercel에 남겨두세요. 새 코드는 읽지 않습니다. 롤백 기간이 끝난 뒤 제거할 수 있습니다. 이전 버전으로 되돌릴 때는 이 공용 비밀번호 변수가 필요하며 회원들이 예전 흐름으로 다시 인증해야 합니다.
