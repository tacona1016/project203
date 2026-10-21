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
| `lib/supabase/` | 공개 키 클라이언트, 조회·등록 함수, DB 타입 |
| `lib/participant-storage.ts` | 참가자 UUID 저장과 구버전 이름 선택 이관 |
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

## Supabase 설정과 마이그레이션

기존 운영 DB는 다음 순서로 Supabase SQL Editor에서 파일 전체를 실행합니다.

1. `supabase/migrations/20261021_participants_and_vote_modes.sql`
2. `supabase/seed_participants.sql` — 기존 코드의 친구 10명을 DB로 옮기는 초기 seed
3. 필요하면 `supabase/seed.sql` — Q4 투표가 없는 환경의 초기 데이터

새 DB는 `supabase/schema.sql`을 먼저 실행한 뒤 위 순서를 따릅니다. slug가 없는 초기 DB는 최신 migration 전에 `supabase/migrations/20261019_poll_slug.sql`도 실행합니다. 예전 권한 migration과 기반 schema를 최신 migration 이후에 재실행하지 마세요. 예전 파일은 투표의 직접 INSERT 권한을 다시 열 수 있습니다.

이번 migration은 기존 숫자 ID와 투표·댓글을 보존합니다. 과거 `participant_name`별로 참가자를 만들고 UUID를 연결합니다. 같은 이름은 같은 참가자로 이관되며 과거 이름이 달랐던 동일인은 자동 병합하지 않습니다. 빈 이름은 비활성 `이름 미지정`으로 연결합니다. 기존 이름 열은 이관 전 기록으로 남지만 새 입력과 표시에는 사용하지 않습니다.

기존 중복 표도 삭제하지 않습니다. Q4는 `allow_repeat_vote = false`로 전환하므로 기존 표가 있는 참가자는 더 참여할 수 없습니다. 과거 중복 표 때문에 기존 자료에서는 참여자 수와 총 투표 수가 다를 수 있습니다.

DB migration을 적용하면 구버전 앱의 직접 투표 INSERT는 거부됩니다. 준비된 앱 변경과 함께 배포하세요. migration을 검증하는 트랜잭션 테스트는 롤백하며 실제 적용과 별개입니다.

### 환경변수

프로젝트 루트의 `.env.local`과 Vercel Project Settings에 같은 공개 값을 설정합니다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY
```

새 환경변수나 패키지는 필요하지 않습니다. `.env.local`은 Git에서 제외됩니다. secret 또는 service_role 키는 사용하지 않습니다. 환경변수가 없어도 빌드는 가능하지만 홈에서는 이름 목록 재시도 안내가 표시됩니다.

### 참가자 관리

친구 목록은 Supabase Table Editor의 `participants`에서 관리합니다.

- `display_name`: 표시 이름. 이름을 수정해도 UUID가 유지되어 과거 댓글에도 새 이름이 표시됩니다.
- `display_order`: 목록 순서.
- `is_active = false`: 선택 목록에서 제외. 기존 기록과 작성자 표시는 유지됩니다.
- 기존 참가자의 이름을 바꿀 때는 행을 삭제·재생성하지 말고 이름만 수정합니다.

`seed_participants.sql`은 초기 이관용입니다. Dashboard에서 이름을 개별 수정한 뒤 예전 seed를 반복 실행하면 이전 이름이 추가될 수 있으므로 재실행하지 마세요.

홈에 처음 방문하면 필수 이름 선택 모달이 표시됩니다. 선택 정보는 `project203_participant`에 `{ id, display_name }`으로 저장하고 재방문할 때 DB의 활성 목록과 대조합니다. 이름 변경은 Header의 **변경**을 사용합니다. 구버전의 이름 저장 값도 활성 참가자와 일치하면 자동 이관됩니다. localStorage가 차단된 브라우저는 현재 탭에서만 선택을 유지합니다.

이름 선택은 Authentication이 아닙니다. 다른 참가자 ID를 선택하거나 localStorage를 바꿀 수 있습니다. **1인 1표는 선택된 participant_id 기준**이며 실제 사람의 신원을 검증하지 않습니다.

### 투표 방식과 MDX

`polls.allow_repeat_vote`가 투표 방식을 결정합니다.

```sql
-- 1인 1표: 기본값. 첫 투표 이후 재투표·변경 불가
update public.polls set allow_repeat_vote = false where slug = 'land-priority';

-- 중복 허용: 같은 참가자가 여러 번 참여
update public.polls set allow_repeat_vote = true where slug = 'YOUR_POLL_SLUG';
```

새 투표는 SQL에서 실제 생성된 ID로 선택지를 연결합니다.

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

중복 허용 투표는 위 INSERT의 마지막 값을 `true`로 설정합니다. MDX에서는 slug를 전달하며 컴포넌트 코드는 수정하지 않습니다.

```mdx
<Poll pollId="2027-q1-priority" />
<CommentSection quarter="2027-q1" />
```

투표는 `submit_vote` RPC로만 등록합니다. DB에서 활성 참가자, Poll, 선택지 소속, 투표 방식을 검증하고 Poll 행 잠금으로 동시 첫 투표를 직렬화합니다. `get_poll_results`는 호출자의 SELECT 권한과 RLS로 표 수·참여자 수를 집계합니다. Chart 라이브러리나 Realtime은 사용하지 않습니다.

댓글은 현재 참가자 UUID로 저장하고 참가자 테이블을 join해 표시합니다. 앞뒤 공백 제거 후 1~1000자로 제한하며, DB도 비활성 참가자의 등록과 잘못된 내용을 차단합니다. 최신순 20개씩 조회합니다.

### 권한

익명 역할은 참가자·Poll·선택지·표·댓글을 읽을 수 있고 댓글을 추가할 수 있습니다. 참가자 선택 목록은 활성 행만 조회하지만 과거 댓글의 이름 표시를 위해 참가자 읽기는 비활성 행도 허용합니다.

votes의 직접 INSERT, 기존 데이터의 UPDATE/DELETE, Poll·선택지·참가자 변경은 허용하지 않습니다. 공개 `submit_vote`는 제한된 작업을 위한 의도적인 SECURITY DEFINER RPC이며 입력 검증, 빈 search_path, 명시적인 EXECUTE 부여를 사용합니다. 로그인·세션·쿠키·API Route·Server Action은 추가하지 않습니다.

## 검증과 로컬 실행

```powershell
npm ci
npm run dev
npm run check:supabase
npm run typecheck
npm run lint
npm run build
```

PowerShell 실행 정책에 걸리면 `npm.cmd`를 사용합니다. 진단 명령은 공개 키로 조회만 하고 값을 출력하지 않습니다. 실제 DB 변경과 등록 시험은 별도로 구분합니다.

- 홈 첫 방문, 이름 선택 전 접근 차단, 키보드 탐색과 Escape 처리를 확인합니다.
- 새로고침·브라우저 재접속 시 선택 유지, 이름 변경, 비활성 참가자 재선택을 확인합니다.
- 1인 1표의 첫 투표·재투표 차단, 다른 참가자의 별도 투표를 확인합니다.
- 중복 허용 투표에서 같은 참가자가 여러 번 참여하는지 확인합니다.
- 댓글 등록, 이름 변경 반영, 빈 내용·1000자 초과 차단을 확인합니다.
- Desktop/Tablet/Mobile에서 홈·Archive·MDX와 가로 넘침을 확인합니다.
- DB 회귀 테스트는 `supabase/tests/participants_and_vote_modes.sql`을 SQL Editor에서 실행합니다. 시험 데이터는 롤백합니다.

## Vercel 배포

1. DB migration과 초기 참가자 seed를 적용합니다.
2. 변경한 파일을 기존 배포 브랜치에 commit/push합니다.
3. 기존 두 환경변수를 Production/Preview 범위에 등록합니다. Node.js 22 이상을 사용합니다.
4. 환경변수를 변경한 경우 새 배포를 생성하거나 Redeploy합니다.
5. 배포 사이트에서도 이름 선택·투표 방식·댓글을 확인합니다.

DB 적용과 앱 배포를 함께 진행하고, 이전 배포의 공개 환경변수는 새 배포 없이는 바뀌지 않는다는 점을 확인합니다.

공식 참고: [Database Functions](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Next.js MDX](https://nextjs.org/docs/app/guides/mdx).
