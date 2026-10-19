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
| `data/participants.ts` | 선택 가능한 친구 이름 목록 |
| `lib/supabase/` | 공개 키 클라이언트, 조회·등록 함수, DB 타입 |
| `lib/useSelectedParticipant.ts` | localStorage 이름 읽기·저장과 컴포넌트 간 동기화 |
| `supabase/schema.sql`, `supabase/seed.sql` | 테이블·권한·RLS 초기 설정과 Q4 샘플 투표 |
| `.env.example` | 로컬·Vercel에 필요한 공개 환경변수 예시 |
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

## Supabase 초기 설정

1. Supabase Dashboard에서 프로젝트를 생성하거나 사용할 프로젝트를 엽니다.
2. **SQL Editor → New query**에서 `supabase/schema.sql` 전체 내용을 붙여 넣고 **Run**을 누릅니다. `polls`, `poll_options`, `votes`, `comments`와 외래 키·RLS·권한이 만들어집니다.
3. 새 쿼리에서 `supabase/seed.sql`을 같은 방식으로 실행합니다. `land-priority` 투표와 선택지 5개가 등록됩니다. 두 SQL은 초기 스키마에서 재실행해도 기존 투표·댓글을 삭제하지 않습니다. 스키마 변경용 마이그레이션 파일은 아닙니다.
4. **Connect / Project Settings → API Keys**에서 Project URL과 공개 `anon` 키를 확인합니다. DB 비밀번호, `service_role`, secret key는 사용하지 않습니다.
5. 프로젝트 루트에 `.env.example`을 복사해 `.env.local`을 만들고 아래 값을 입력합니다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

`.env.local`은 Git에서 제외됩니다. 브라우저에도 전달되는 공개 키이며, DB 접근은 RLS와 테이블 권한으로 제한합니다. 환경변수가 없거나 URL 형식이 잘못된 경우 기존 페이지는 동작하고 투표·댓글 자리에는 준비 중 안내가 나타납니다. 값을 변경한 후 개발 서버를 재시작합니다.

이름은 인증 수단이 아닙니다. 공개 URL·키를 아는 사람은 이름을 임의로 기입하고 허용된 데이터를 조회·추가할 수 있으므로, 이 구성 자체가 비공개 접근을 보장하지는 않습니다. 요청한 범위대로 익명 SELECT와 투표·댓글 INSERT만 허용하며 UPDATE/DELETE, Poll 편집, id·작성시간 지정은 허용하지 않습니다. 이름 목록은 UI용이고 DB에 중복 관리하지 않습니다.

## 이름·투표·댓글

- 친구 이름은 `data/participants.ts`만 수정합니다. 앞뒤 공백 없는 고유한 표시 이름을 80자 이내로 작성하세요. 브라우저의 `project203_selected_user` localStorage에 저장하며 상단 **변경**으로 다시 선택합니다. 목록에서 제거된 이름은 다시 선택해야 합니다. 과거 기록의 이름은 자동 변경되지 않습니다.
- `lib/supabase/server.ts`는 공개 키로 최초 데이터를 서버에서 읽습니다. 환경변수가 설정된 분기 페이지는 요청 시 데이터를 조회하며, 홈은 정적으로 유지됩니다. `Suspense`로 기존 Presentation 표시가 DB 응답을 기다리지 않게 합니다.
- `lib/supabase/client.ts`와 `queries.ts`가 브라우저의 등록·결과 갱신을 담당합니다. 세션·쿠키·Authentication·API Route·Server Action·Realtime은 사용하지 않습니다.
- 투표는 중복 참여가 가능하며 선택지별 정확한 COUNT로 집계합니다. 현재 결과는 투표 전후 모두 볼 수 있습니다.
- 댓글은 앞뒤 공백 제거 후 1~1000자이며 DB에서도 검사합니다. 최신순 20개씩 표시하고 **이전 의견 더 보기**로 이어서 조회합니다. 시간은 한국 시간입니다. 수정·삭제·대댓글은 없습니다.

새 분기에도 다음 컴포넌트만 넣으면 됩니다. DB에서 투표를 먼저 추가하고, 사이트 전체에서 고유한 `polls.slug`(예: `2027-q1-land-priority`)를 사용하세요. MDX의 `pollId`에는 이 slug를 넣으며 실제 숫자/UUID ID는 조회·등록 코드에서 처리합니다. `seed.sql`을 참고해 새 Poll과 선택지를 추가합니다. 과거 응답이 있는 투표의 의미를 바꾸기보다는 새 Poll을 만드세요.

```mdx
<Poll pollId="2027-q1-land-priority" />
<CommentSection quarter="2027-q1" />
```

MDX를 복사할 때 기존 Poll id도 교체해야 새 분기 투표가 분리됩니다. 댓글은 `quarter` 값으로 분리됩니다.

## 로컬 기능 확인

```powershell
npm ci
npm run dev
```

PowerShell에서 실행 정책으로 npm이 차단되면 `npm.cmd`를 사용합니다.

1. `/`에서 이름 선택 후 새로고침해 이름이 유지되는지 확인합니다.
2. `/quarter/2026-q4#poll`에서 투표하고 결과가 증가하는지 확인합니다. 같은 이름으로 다시 투표해도 저장됩니다.
3. `#comments`에서 댓글을 등록하고 이름·내용·시간을 확인합니다. 다른 브라우저에서 다시 열어 DB 저장 여부를 확인합니다.
4. 이름을 변경해 다음 투표·댓글에 새 이름이 쓰이는지 확인합니다. 빈 댓글·공백만 있는 댓글·1000자 초과 댓글은 등록할 수 없습니다.
5. Dashboard Table Editor에서 `votes`, `comments`에 새 행이 생겼는지 확인합니다.
6. `npm run typecheck`, `npm run lint`, `npm run build`를 실행합니다. 환경변수를 비워도 빌드는 성공해야 합니다.

## Vercel 배포

투표가 불러와지지 않으면 프로젝트 터미널에서 `npm run check:supabase`를 실행합니다. `.env.local`의 공개 키로 투표·선택지·결과·댓글 조회만 검사하며 키는 출력하지 않습니다. 데이터가 없으면 `seed.sql`, 테이블·권한 오류라면 `schema.sql` 설정을 확인합니다. 진단이 성공하는데 배포 사이트만 실패한다면 Vercel의 환경변수와 재배포 여부를 확인합니다.

기존 DB의 `polls.id`가 bigint인데 `land-priority`를 ID로 조회하면 `22P02`가 발생합니다. 기존 DB에서는 **SQL Editor에서 `supabase/migrations/20261019_poll_slug.sql` → `supabase/seed.sql` 순서로 실행**하고 수정한 앱을 재배포합니다. 숫자 ID와 외래 키, 기존 투표·댓글은 유지됩니다. seed는 기존 Q4 투표가 하나이거나 질문이 일치하면 그 투표를 `land-priority` slug에 연결합니다. 최초 text ID 스키마도 같은 절차를 사용합니다. 새 DB는 `schema.sql` → `seed.sql`을 실행합니다.

SQL Editor에 선택지가 있는데 공개 조회는 0개라면 `supabase/migrations/20261019_interaction_policies.sql`을 실행합니다. 익명 SELECT와 투표·댓글 INSERT 권한을 재적용하고 실제 선택지 수를 표시합니다. 이어서 `npm run check:supabase`로 공개 조회를 다시 확인합니다.

1. Vercel의 해당 **Project → Settings → Environment Variables**에 위의 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 같은 값으로 등록합니다. 사용할 Production/Preview/Development 환경을 선택합니다. 설치된 Supabase SDK는 Node.js 22 이상이 필요하므로 프로젝트의 Node.js Version도 확인합니다.
2. 기존에 연결된 Git 저장소의 배포 브랜치에 변경 사항을 commit/push하면 자동 배포됩니다. `.env.local`은 올리지 않습니다.
3. 환경변수만 바꿨다면 **Deployments → 해당 배포 → Redeploy**를 실행합니다. `NEXT_PUBLIC_*` 값은 빌드 시 브라우저 번들에 포함되므로 재배포가 필요합니다.
4. 배포 URL에서 위 로컬 기능 확인을 반복합니다. Vercel 전용 코드나 추가 서버 설정은 없습니다.

관련 공식 문서: [Supabase JS 초기화](https://supabase.com/docs/reference/javascript/initializing), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Next.js 요청 시 렌더링](https://nextjs.org/docs/app/api-reference/functions/connection).

## 설정 참고

- [Next.js 설치 및 수동 구성](https://nextjs.org/docs/app/getting-started/installation)
- [Next.js 공식 MDX 가이드](https://nextjs.org/docs/app/guides/mdx)
- [Tailwind CSS의 Next.js 설정](https://tailwindcss.com/docs/installation/framework-guides/nextjs)
