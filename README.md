# 203 PROJECT

분기마다 MDX 프레젠테이션을 추가하고 기존 자료를 Archive에 보관하는 웹사이트입니다. Next.js 16.4.2 App Router, TypeScript, Tailwind CSS 4, 공식 `@next/mdx`, npm을 사용합니다. Presentation은 Server Component로 유지하고, 이름 선택·투표·댓글의 브라우저 상호작용만 Client Component로 구현합니다. 데이터는 Supabase PostgreSQL에 저장합니다.

## 로컬 실행

Node.js 22 이상과 npm이 필요합니다. Node.js LTS 사용을 권장합니다.

```powershell
cd C:\project203
npm install
npm run dev
```

- 홈: http://localhost:3000
- 2026 Q4 Project Kick-off: http://localhost:3000/quarter/2026-q4

의존성 버전은 `package-lock.json`에 고정되어 있습니다. 동일 환경을 재현할 때는 `npm ci`를 사용합니다.

```powershell
npm run lint
npm run typecheck
npm run build
npm run start
```

`typecheck`는 Next.js 라우트 타입을 먼저 생성하고 TypeScript를 검사합니다. `build`는 MDX 컴파일과 페이지의 프로덕션 빌드도 검사합니다. ESLint는 TypeScript·TSX·설정 파일을 검사하며, MDX는 빌드에서 검사합니다.

## 주요 파일

| 경로 | 역할 |
| --- | --- |
| `app/layout.tsx` | 한국어 문서, 공통 메타데이터, 본문 건너뛰기 링크 |
| `app/page.tsx` | 최신 분기 Current와 연도별 전체 Archive |
| `app/globals.css` | Tailwind 테마 토큰, 타이포그래피, 공통·반응형 스타일 |
| `app/quarter/2026-q4/page.mdx` | 킥오프 자료 9개 섹션과 투표·댓글 섹션 |
| `components/presentation/` | MDX용 기본 레이아웃과 MetricGrid, Timeline, Checklist |
| `components/interactive/` | 이름 선택, 투표·결과, 댓글 입력·목록 UI |
| `components/interactive/ParticipantProvider.tsx` | DB 참가자 목록, 선택 Context와 필수 모달 |
| `lib/supabase/` | 서버 전용 클라이언트, 조회·등록 함수, DB 타입 |
| `lib/participant-storage.ts` | 참가자 UUID 저장과 구버전 이름 선택 이관 |
| `supabase/schema.sql`, `supabase/seed.sql` | 테이블·권한·RLS 초기 설정과 Q4 샘플 투표 |
| `.env.example` | 로컬·Vercel 환경변수의 빈 템플릿 |
| `components/SiteHeader.tsx` | 고정 상단 탐색, 홈 링크, 현재 프레젠테이션의 분기 표시 |
| `components/QuarterCover.tsx` | 분기 데이터로 그리는 공통 표지 그래픽 |
| `data/quarters.ts` | 분기 메타데이터, 최신순 정렬, 페이지 메타데이터 생성 |
| `mdx-components.tsx` | MDX에서 import 없이 사용할 프레젠테이션 컴포넌트 등록 |
| `next.config.mjs` | App Router의 `page.mdx` 라우팅 및 공식 MDX 컴파일 설정 |
| `public/images/2026-q4/` | 초기 분기 이미지와 샘플 SVG |

## 새로운 분기 추가

1. `app/quarter/2026-q4/page.mdx`를 `app/quarter/2027-q1/page.mdx`로 복사합니다.
2. 새 MDX에서 `2026-q4`를 모두 `2027-q1`로 바꾸고, 본문과 이미지 경로를 수정합니다.
3. `data/quarters.ts`의 `quarters` 배열에 다음 항목을 추가합니다.

```ts
{
  slug: "2027-q1",
  year: 2027,
  quarter: 1,
  title: "Quarterly Presentation",
  description: "새로운 분기의 진행사항과 다음 계획을 살펴봅니다.",
  publishedAt: "2027-01-15",
},
```

4. 이미지가 있다면 `public/images/2027-q1/`에 넣고 MDX에서 `/images/2027-q1/파일명`으로 참조합니다.
5. `npm run lint`, `npm run typecheck`, `npm run build`를 실행합니다.

추가한 분기는 파일 경로로 라우트가 생성되고, 메타데이터로 Current와 Archive에 반영됩니다. 컴포넌트나 메인 페이지는 수정할 필요가 없습니다. Current는 `publishedAt`이 가장 늦은 항목이며, 같은 날짜이면 연도·분기가 큰 항목을 사용합니다. 날짜는 `YYYY-MM-DD`로 작성합니다. 배열을 직접 정렬할 필요는 없습니다. 등록된 항목은 모두 공개되므로 미래 분기를 미리 숨겨 두는 예약 게시 기능은 없습니다.

Archive에는 최신 분기도 포함해 모든 등록 자료를 보관합니다. 실제 MDX 경로와 데이터의 `slug`가 일치해야 합니다. MDX의 페이지 export는 `metadata` 등 Next.js가 허용한 필드만 사용합니다.

## MDX 작성

기본 컴포넌트는 `mdx-components.tsx`에 등록되어 있습니다. 새로운 컴포넌트를 만들 때 이 파일에 추가하면 모든 분기 MDX에서 사용할 수 있습니다.

```mdx
import { getQuarter, getQuarterMetadata } from "@/data/quarters";

export const metadata = getQuarterMetadata(getQuarter("2027-q1"));

<Presentation quarter={getQuarter("2027-q1")}>

<Hero
  quarter={getQuarter("2027-q1")}
  title="새로운 분기의 시작."
  description="지난 기록을 바탕으로 다음 방향을 살펴봅니다."
/>

<Slide id="summary" number="01" label="Quarterly Summary" tone="soft">

<SectionTitle title="이번 분기의 주요 진행사항" description="핵심 내용부터 차례로 정리합니다." />

<TwoColumn>
<div>

### 진행한 일

- 이번 분기 주요 진행사항
- 현재 프로젝트 상태

</div>
<div>

### 다음 계획

주요 검토 항목과 다음 분기 계획을 적습니다.

</div>
</TwoColumn>

<ImageBlock
  src="/images/2027-q1/overview.png"
  alt="이미지가 전달하는 내용을 구체적으로 설명합니다."
  width={1600}
  height={900}
  caption="필요할 때만 짧은 설명을 덧붙입니다."
/>

</Slide>

</Presentation>
```

- `Presentation`: 상단 탐색, 본문과 하단 홈 링크를 제공합니다.
- `Hero`: 표지 제목·설명·분기를 표시합니다. 표지의 다음 링크는 `id="summary"` 섹션으로 이동하므로 첫 본문 슬라이드는 이 id를 사용합니다.
- `Slide`: `id`, `number`, `label`, `children`이 필요합니다. `tone`은 `default`, `soft`, `accent` 중 선택합니다. id는 페이지 안에서 중복 없이 작성합니다.
- `SectionTitle`: `title`이 필요하고 `description`은 선택 사항입니다.
- `TwoColumn`: 두 개의 직계 자식 블록을 넣습니다. 768px 이상에서는 2열, 작은 화면에서는 1열입니다.
- `ImageBlock`: `src`, `alt`, 원본 이미지의 `width`·`height`가 필요합니다. `caption`은 선택 사항입니다. Next.js Image를 사용하며 원본 비율을 유지합니다.
- `MetricGrid`: `metrics`에 `{ value, label, description? }` 배열을 전달합니다. 숫자·조건을 큰 타이포그래피로 표시합니다.
- `Timeline`: `steps`에 `{ title, description?, current? }` 배열을 전달합니다. 순서대로 Phase 번호가 붙고 `current: true`인 단계에는 현재 위치가 표시됩니다.
- `Checklist`: `groups`에 `{ title, items: string[] }` 배열을 전달합니다. 체크 표시는 읽기·인쇄용이며 입력, 클릭 상태, 저장 기능이 없습니다.

JSX 블록과 Markdown 본문 사이에는 빈 줄을 넣습니다. 짧은 본문은 Markdown으로 작성하고, 레이아웃이 필요한 곳에만 컴포넌트를 사용합니다. 표지의 h1 아래에는 SectionTitle의 h2, 세부 항목의 h3를 사용합니다. 기본 폰트는 시스템 폰트이며, 빌드 중 외부 폰트 다운로드가 필요하지 않습니다.

## 비공개 접근과 환경변수

`/access`에서 공용 비밀번호를 서버로 제출합니다. `proxy.ts`가 일반 페이지와 이미지 접근을 검사하고, 홈·Presentation·모든 데이터 API는 서버에서 세션을 다시 확인합니다. 인증 전에는 참가자 Provider도 실행하지 않습니다.

프로젝트 루트에 `.env.local`을 만들고 다음 네 값을 설정합니다. 실제 값은 코드나 문서에 기록하지 않습니다.

| 변수 | 구분 | 용도 |
| --- | --- | --- |
| `SITE_ACCESS_PASSWORD` | server secret | 공용 비밀번호 |
| `SITE_SESSION_SECRET` | server secret | 세션 서명, 32바이트 이상 |
| `SUPABASE_SECRET_KEY` | server secret | Supabase Dashboard의 API Keys → Secret key |
| `NEXT_PUBLIC_SUPABASE_URL` | public config | Supabase Project URL |

`.env.example`에는 빈 항목만 있습니다. 기존 `NEXT_PUBLIC_SUPABASE_ANON_KEY`·Publishable Key는 사용하지 않으므로 로컬·Vercel 설정에서 제거할 수 있습니다. 환경변수가 없어도 빌드는 성공하지만 입장과 데이터 접근은 차단됩니다. `.env.local`은 Git에서 제외됩니다.

세션 서명값은 다음 명령을 **본인의 로컬 터미널에서** 생성하여 비밀 환경변수에 보관합니다.

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Node.js 표준 `crypto`의 HMAC-SHA256과 `timingSafeEqual`을 사용합니다. 토큰에는 authorized·issuedAt·expiresAt만 포함합니다. HttpOnly, SameSite=Lax, Path=/, production Secure 쿠키와 서명 토큰 모두 발급부터 정확히 30일에 만료하며 자동 연장하지 않습니다. 비밀번호는 쿠키·localStorage·URL에 저장하지 않습니다.

비밀번호만 변경하면 기존 세션은 유지됩니다. `SITE_SESSION_SECRET`을 변경하고 재배포하면 이전 키로 서명한 모든 세션이 무효화됩니다. Header의 **사이트 잠그기**는 현재 브라우저의 쿠키만 지우고 참가자 선택은 보존합니다.

## Supabase 설치와 권한 전환

기존 참가자·투표 방식 migration이 적용된 운영 DB는 **`supabase/migrations/20261023000000_private_site_access.sql`만 검토 후 SQL Editor에서 전체 실행**합니다. 자동 실행하지 않습니다. 기존 데이터·ID는 변경하지 않습니다. seed 재실행도 필요하지 않습니다.

새 DB의 실행 순서:

1. `supabase/schema.sql`
2. `supabase/migrations/20261019_poll_slug.sql`
3. `supabase/migrations/20261021_participants_and_vote_modes.sql`
4. `supabase/seed_participants.sql`, `supabase/seed.sql`
5. `supabase/migrations/20261023000000_private_site_access.sql` — 항상 마지막

private migration은 다섯 테이블의 anon/authenticated 테이블·열 권한, 연결 sequence 권한과 기존 RPC 공개 실행 권한을 회수합니다. RLS·기존 정책을 보존하면서 restrictive 차단 정책을 추가합니다. `submit_vote`는 기존 검증·잠금을 유지하고 SECURITY INVOKER로 변경하여 서버 역할에만 실행을 허용합니다.

Browser → 세션 검증 API → server-only Supabase client 순서입니다. `lib/site-api.ts`에는 내부 fetch만 있고 SDK·키가 없습니다. 모든 보호 API는 세션을 검사하고, 쓰기는 same-origin 및 입력값도 검사합니다. 서버 키는 RLS를 우회하므로 댓글의 활성 참가자는 서버가 명시적으로 확인합니다. 임의 SQL·테이블 조작 endpoint는 없습니다.

migration 전에는 기존 공개 키로 DB 직접 접근이 가능합니다. migration 후에는 구버전 앱의 직접 Supabase 요청이 거부됩니다. 환경변수·앱 배포·DB 권한 전환을 함께 준비하세요. 이전 Preview/Production 배포도 전환하거나 비활성화해야 합니다. 옛 schema·권한 migration을 이후에 재실행하지 마세요.

### 참가자 관리

Supabase Table Editor의 `participants`에서 `display_name`, `display_order`, `is_active`를 관리합니다. 이름은 행을 삭제·재생성하지 말고 수정합니다. UUID가 유지되므로 이전 댓글에도 변경된 이름이 표시됩니다. 비활성 행은 선택 목록에서 제외하며 기존 작성자 표시는 유지됩니다.

비밀번호 인증 후 홈페이지에 처음 들어가면 필수 이름 선택 모달이 표시됩니다. `project203_participant` localStorage에 `{ id, display_name }`을 저장하고 재방문 시 활성 목록과 대조합니다. Header의 **변경**으로 다시 선택합니다. 구버전 이름 저장 값도 활성 참가자와 일치하면 자동 이관합니다.

이름 선택은 본인 인증이 아닙니다. **1인 1표는 선택된 participant_id 기준**이며 다른 이름 선택을 방지하지 않습니다. 공용 비밀번호도 개인 신원을 검증하지 않습니다.

### 투표 방식과 MDX

```sql
-- 1인 1표: 기본값. 첫 투표 이후 재투표·변경 불가
update public.polls set allow_repeat_vote = false where slug = 'land-priority';

-- 중복 허용: 같은 참가자가 여러 번 참여
update public.polls set allow_repeat_vote = true where slug = 'YOUR_POLL_SLUG';
```

새 투표는 실제 생성된 ID로 선택지를 연결합니다.

```sql
with new_poll as (
  insert into public.polls (slug, quarter, title, description, allow_repeat_vote)
  values ('2027-q1-priority', '2027-q1', '다음 분기의 우선순위는?', '한 가지를 선택해주세요.', false)
  returning id
)
insert into public.poll_options (poll_id, label, display_order)
select new_poll.id, choice.label, choice.display_order
from new_poll cross join (values ('접근성', 1), ('토지 조건', 2)) choice(label, display_order);
```

MDX에서는 slug를 전달하며 컴포넌트 코드는 수정하지 않습니다.

```mdx
<Poll pollId="2027-q1-priority" />
<CommentSection quarter="2027-q1" />
```

표는 서버를 거쳐 `submit_vote` RPC로만 등록합니다. DB가 활성 참가자, Poll, 선택지 소속, 투표 방식을 검증하고 Poll 행 잠금으로 동시 첫 투표를 직렬화합니다. 결과는 참여자 수와 총 표 수를 구분합니다.

댓글은 현재 참가자 UUID로 저장하고 이름을 join합니다. 앞뒤 공백 제거 후 1~1000자로 제한하며 최신순 20개씩 조회합니다. 수정·삭제·Realtime은 추가하지 않습니다.

## 검증

```powershell
npm test
npm run check:supabase
npm run typecheck
npm run lint
npm run build
```

PowerShell에서 실행 정책에 걸리면 `npm.cmd`를 사용합니다. Node.js 기본 test runner는 30일 만료 경계·변조·키 교체·비밀번호 비교를 검사합니다. 진단 명령은 서버 키로 조회만 하며 키·본문을 출력하지 않습니다.

- 인증 없는 홈·분기 접근은 `/access`, 보호 API 직접 호출은 401인지 확인합니다.
- 틀린 비밀번호·올바른 비밀번호·원래 페이지 복귀·새로고침·재접속·잠그기를 확인합니다.
- 이름 선택·변경·저장, 단일/중복 투표, 댓글 등록·목록과 입력 검증을 확인합니다.
- Desktop/Tablet/Mobile에서 홈·Archive·MDX와 가로 넘침을 확인합니다.
- private migration 적용 후 `supabase/tests/private_site_access.sql`로 공개 권한 회수를 검사합니다. 데이터 변경 없는 assertion입니다.
- 이전 `participants_and_vote_modes.sql` 테스트는 공개 anon 구조 전용이므로 private migration 이후 운영 DB에서 실행하지 않습니다.

## Vercel 배포

1. Project Settings → Environment Variables에 위 네 값을 Production 및 필요한 Preview 범위에 등록합니다. 비밀 값 세 개는 Secret, URL은 Config로 관리합니다.
2. migration을 검토하고 적용·배포 시간을 정합니다. DB 권한 전환 전까지 데이터는 완전히 비공개가 아닙니다.
3. 변경을 배포 브랜치에 commit/push하여 기존 Git 연동으로 새 배포를 만듭니다. 환경변수만 변경한 경우에도 Redeploy합니다. Node.js 22 이상을 사용합니다.
4. SQL Editor에서 private migration 전체를 실행하고 권한 assertion을 확인합니다.
5. 배포 URL에서 비밀번호 → 이름 → 투표·댓글과 잠그기를 확인합니다. 이전 공개 배포도 전환합니다.

공식 참고: [Next.js Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy), [Authentication](https://nextjs.org/docs/app/guides/authentication), [Supabase API keys](https://supabase.com/docs/guides/api/api-keys), [Data API security](https://supabase.com/docs/guides/api/securing-your-api).
