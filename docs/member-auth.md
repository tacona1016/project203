# 회원 인증 전환과 운영

## 흐름과 세션

기존: 공용 비밀번호 → 자유로운 이름 선택 → 게시판 개인 비밀번호.

변경: `/access`에서 활성 회원 이름과 기존 개인 비밀번호 확인 → 사이트 전체 이용. 관리자 기능에는 ADMIN_PASSWORD 추가 확인이 필요합니다. 로그인 이름은 변경할 수 없으며 회원을 바꾸려면 로그아웃 후 해당 비밀번호로 로그인합니다.

`BOARD_PARTICIPANT_PASSWORDS` 환경변수 이름과 UUID 매핑을 그대로 사용합니다. 서버는 비밀번호를 변형 없이 비교합니다. 빈 문자열만 거부하며 길이·문자 종류·조합 제한은 없습니다. 숫자만 있는 `1234`나 한 글자 비밀번호도 사용할 수 있습니다. 회원 쿠키 `project203_member`는 UUID·고유 로그인 nonce·발급/만료 시각에 서명하며 30일 유지합니다. 서명 키는 기존 HMAC-SHA256에서 새로운 회원 인증 목적/버전과 해당 회원 비밀번호로 파생합니다. 비밀번호는 쿠키에 들어가지 않습니다.

예전 project203_access/project203_board/project203_participant_selection 쿠키와 localStorage는 새 로그인 증명이 아닙니다. 첫 개인 로그인은 반드시 다시 해야 합니다. 로그인·로그아웃 때 이전 쿠키도 만료합니다.

회원 자격은 매 요청에서 현재 매핑·서명·만료와 DB의 is_active를 검사합니다. DB 조회 실패 시 접근을 허용하지 않습니다. 비밀번호 변경/매핑 제거/회원 비활성화 후에는 다음 보호 요청부터 거부됩니다. 서버 렌더 내부 중복 조회만 React cache로 합치고 회원 자격을 전역·공유 캐시하지 않습니다.

관리자 쿠키는 8시간이며 서명 목적을 분리하고 현재 회원 쿠키 전체에 연결합니다. 로그아웃·다른 회원 로그인·같은 회원 재로그인·회원 무효화 후 이전 관리자 쿠키는 유효하지 않습니다. 관리자 권한으로 타인 명의 투표·댓글을 제출할 수 없습니다.

## 공개 범위와 API

공개: `/access`, `/api/access` 로그인 POST, `/api/access/participants`의 활성 UUID·이름, 로그인 정적 리소스.

그 외 페이지·API·이미지는 Proxy와 서버 데이터 접근 지점에서 회원 자격을 검사합니다. API는 401/403, 페이지는 안전한 내부 return path를 담아 로그인으로 이동합니다. 보호 응답은 private/no-store입니다. 비밀번호 매핑·회원별 설정 상태·DB 전체 행을 공개 목록에 넣지 않습니다.

투표·내 참여 조회·발표 댓글·게시판 작성자는 서버 세션에서 결정합니다. 예전 body/query의 participantId·authorId는 다른 회원 작업을 허용하지 않으며 작성 API는 허용 필드만 받습니다. 예전 이름 선택 POST 및 게시판 추가 인증 POST는 회원 로그인 후에도 410입니다.

사용자 로그인 실패 문구는 동일합니다. 서버에는 `[member-auth] invalid_credentials`, `invalid_json`, `missing_participant`, `empty_password`, `inactive_or_unknown_member`, `directory_unavailable`, `session_configuration` 등 원인 코드만 남깁니다. ID·비밀번호·토큰·환경변수 원문·DB 오류 원문을 로그에 넣지 않습니다.

## 환경변수

- SITE_SESSION_SECRET: 계속 사용; 회원/관리자 서명용 서버 비밀
- BOARD_PARTICIPANT_PASSWORDS: 기존 UUID → 개인 비밀번호 JSON; 사이트 전체 로그인에 사용
- ADMIN_PASSWORD: 기존 관리자 추가 인증
- SUPABASE_SECRET_KEY: 기존 server-only DB 키
- NEXT_PUBLIC_SUPABASE_URL: 기존 프로젝트 URL

값을 임의로 바꾸거나 회원 비밀번호를 초기화하지 않습니다. 여러 회원이 같은 비밀번호를 쓰는 설정도 허용하지만 그 비밀번호로 해당 이름들에 로그인할 수 있으므로 운영에서는 회원별 서로 다른 비밀번호가 필요합니다.

로컬 `.env.local`의 `$`는 Next.js 환경변수 확장 규칙에 따라 `\$`로 이스케이프해야 합니다. JSON의 따옴표/역슬래시는 JSON 규칙도 지켜야 합니다. Vercel Value에는 JSON 객체 자체를 넣으며 .env용 바깥 작은따옴표를 붙이지 않습니다. 브라우저 입력과 서버 값은 임의로 trim하지 않습니다.

## 반영과 롤백

1. 코드와 환경변수 이름을 검토하고 로컬 검사 및 가짜 계정 통합 검사를 실행합니다.
2. 기존 UUID/개인 비밀번호 매핑을 변경하지 않은 상태로 Preview에서 새 흐름을 확인합니다. Preview와 Production에 필요한 5개 변수가 등록되어 있는지 확인합니다.
3. 승인 후 변경 브랜치를 병합/배포하고 로그인·관리자·투표·댓글·게시판·사진을 확인합니다. 이 작업은 자동으로 운영 배포하지 않습니다.
4. 기존 이용자 모두 새 개인 로그인을 한 번 수행합니다. 공용 비밀번호는 요구하지 않습니다.
5. SITE_ACCESS_PASSWORD는 새 버전 검증과 롤백 기간 동안 Vercel에 남겨둡니다. 새 코드는 사용하지 않으므로 필수값이 아닙니다. 롤백 기간 이후 제거할 수 있습니다.

DB 변경/seed 실행은 없습니다. 이전 배포로 롤백하려면 SITE_ACCESS_PASSWORD를 유지/복원하고 이전 코드로 배포합니다. 예전 공용/게시판 흐름으로 다시 인증해야 하며 UUID·기존 데이터는 그대로입니다. 회원 코드의 쿠키는 구버전이 인증으로 인정하지 않습니다. SITE_SESSION_SECRET을 회전하면 새 버전과 구버전 모두 기존 세션이 무효화됩니다.

환경변수 이스케이프 규칙: [Next.js 공식 문서](https://nextjs.org/docs/app/guides/environment-variables#referencing-other-variables).

## 검증 방법과 한계

- `npm.cmd test`: 서명·UUID·만료·비밀번호/설정 변경·기존 쿠키 거부·관리자 로그인 결합 및 기존 Poll/Board 입력 단위 테스트
- `npm.cmd run test:integration`: 실제 Next.js 요청 → 서버 인증 → 가짜 Supabase HTTP fixture → 응답 검사
- `npm.cmd run test:production`: 가짜 환경의 production build/start, Secure 쿠키, 브라우저 번들 비밀값 canary 검사
- `npm.cmd run test:browser`: 위 검사와 Chrome 모바일·자동완성·Enter·원래 경로 복귀·두 탭 로그아웃·브라우저 재시작 검사
- `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run build`

통합 검사는 `.verification/member-auth-app`에 소스를 복사하고 가짜 계정과 이미지·DB 프로토콜만 사용합니다. 원본 `.env.local`, 실제 회원 비밀번호, 운영 DB를 읽거나 수정하지 않습니다. 테스트 포트는 3100/3102/3103이고 Chrome은 9230입니다. 실제 PostgreSQL 트랜잭션/RLS·Vercel Production cookie/CDN은 이 검사만으로 검증되지 않습니다. 운영 반영 후 별도 확인이 필요합니다.

Windows 격리 Chrome은 암호화 쿠키 저장소를 재실행 후 복원하지 못했습니다. 테스트는 30일 영구 쿠키 속성을 확인하고, 브라우저 재시작 후 가짜 쿠키를 메모리에서 재주입하여 서버 수용 여부를 검사했습니다. 실제 사용자 브라우저의 디스크 저장/재실행 유지 여부는 수동 확인이 필요합니다.
