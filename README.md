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
| `app/page.tsx` | 최신 Presentation과 Active Polls 요약 |
| `app/globals.css` | Tailwind 테마 토큰, 타이포그래피, 공통·반응형 스타일 |
| `app/quarter/2026-q4/page.mdx` | 킥오프 자료 9개 섹션과 댓글 섹션 |
| `components/interactive/TextBallot.tsx`, `TextResponses.tsx` | 주관식 내 응답 입력·수정과 공개된 전체 응답 |
| `lib/auth/participant-session.ts` | 현재 선택한 이름을 사이트 세션에 연결하여 본인 응답 조회를 제한 |
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

## 사이트 구조

BOARD의 게시글·관리자 공지·댓글·개인 본인 확인·신규 SQL 적용은 [게시판 운영 안내](docs/board.md)를 참조합니다. 디자인 사진은 [비공개 이미지 안내](private-assets/README.md)에 따라 VSCode에서 추가하며 웹 업로드는 제공하지 않습니다.

| 경로 | 역할 |
| --- | --- |
| `/` | 프로젝트 소개, 최신 Presentation, 진행 중인 Poll 요약 |
| `/archive` | Git + MDX로 관리하는 분기 자료 목록 |
| `/quarter/2026-q4` | 기존 Presentation URL과 댓글 유지 |
| `/polls` | 현재 분기의 Poll 목록과 과거 분기 Poll Archive |
| `/polls/2026-q4` | 해당 분기의 진행 중/예정 및 종료된 Poll 목록 |
| `/polls/[slug]` | 기존 Poll 상세 URL: 투표·선택 변경·결과 |
| `/board` | 자유게시판·관리자 공지·검색·페이지네이션 |
| `/board/new`, `/board/[id]`, `/board/[id]/edit` | 게시글 작성·상세·수정과 댓글 |
| `/admin` | 별도 비밀번호와 Poll dashboard |
| `/admin/polls` | Poll 목록·종료·재개·숨김 |
| `/admin/polls/new` | 새 Poll 생성 |
| `/admin/polls/[slug]/edit` | 제목·설명·기간·변경 허용·숨김 수정 |

Presentation 안의 Poll은 제거하고 독립 페이지로 옮겼습니다. 투표 데이터는 그대로 유지합니다. 새 MDX에는 Poll을 직접 넣지 않습니다. 댓글은 기존 `<CommentSection quarter="2027-q1" />`를 계속 사용합니다. 분기를 추가하는 작업은 MDX·metadata·이미지 추가로 유지됩니다.

## 분기별 Poll 관리

분기의 단일 원본은 `data/quarters.ts`입니다. `getCurrentQuarter()`는 최신 `publishedAt` 항목을 반환하며 Home과 Polls, Admin 기본값이 함께 사용합니다. `getArchivedQuarters()`는 나머지 분기를 최신순으로 반환합니다. 오늘 날짜로 분기를 추측하지 않습니다.

- `/polls`: Current Quarter의 진행 중/종료됨 탭, 아래에는 과거 분기별 Poll 수와 Active·Upcoming·Closed 수를 표시합니다. 숨긴 Poll은 일반 목록과 집계에서 제외합니다.
- `/polls/<quarter>`: 해당 분기의 Poll만 표시합니다. 기존 `/polls/<poll-slug>` 상세 링크와 같은 동적 라우트에서 등록된 분기인지 구분하므로 기존 URL도 유지됩니다. 분기 형태의 slug는 Poll 식별자로 사용하지 않습니다.
- Home: Current Quarter의 ACTIVE Poll을 최대 3개 표시하고, 다른 분기의 ACTIVE Poll이 있으면 Archive 링크를 표시합니다.
- Admin: Quarter/Status 필터와 분기별 전체 수(숨김 포함)를 제공합니다. 생성 시 Current가 기본 선택되며 등록된 분기만 저장할 수 있습니다. 투표가 없는 Poll만 Edit에서 분기를 바꿀 수 있습니다. Next.js 검증과 DB transaction/trigger가 함께 검사합니다.

**Quarter는 분류 기준입니다.** 과거 분기라도 `is_closed=false`, `is_hidden=false`이며 투표 기간 안이면 계속 참여할 수 있습니다. 시작·종료가 모두 null이면 상시 투표입니다. 분기가 바뀌어도 자동 종료하지 않습니다. 새 분기를 metadata에 등록하면 Poll이 없어도 빈 목록과 Admin 선택지에 자동 반영됩니다.

## 환경변수와 세션

로컬 `.env.local`과 Vercel에 다음 값을 설정합니다. 실제 값은 코드·문서·Git에 기록하지 않습니다.

| 변수 | 구분 | 용도 |
| --- | --- | --- |
| `SITE_ACCESS_PASSWORD` | server secret | 기존 공용 비밀번호 |
| `SITE_SESSION_SECRET` | server secret | 기존 30일 access session 서명 |
| `ADMIN_PASSWORD` | server secret | 새 관리자 비밀번호 |
| `BOARD_PARTICIPANT_PASSWORDS` | server secret | BOARD 개인 비밀번호의 participant UUID → 비밀번호 JSON 매핑 |
| `SUPABASE_SECRET_KEY` | server secret | 기존 Supabase 서버 전용 키 |
| `NEXT_PUBLIC_SUPABASE_URL` | public config | 기존 Project URL |

사이트 접근과 Poll은 기존 다섯 값을 유지합니다. BOARD 작성에는 서버 전용 `BOARD_PARTICIPANT_PASSWORDS`를 추가합니다. 관리자 키는 SITE_SESSION_SECRET에서 목적이 다른 HMAC 키로 파생하여 사이트 쿠키와 상호 사용할 수 없습니다. 별도 `project203_admin` 쿠키/서명 토큰은 8시간에 만료하고, 사이트의 `project203_access`는 기존처럼 30일입니다. 모두 HttpOnly·SameSite=Lax·Path=/·production Secure를 사용합니다.

Admin은 사이트 인증과 관리자 인증을 모두 요구하지만 participant 선택과 무관합니다. 일반 페이지는 participant 선택 후 이용합니다. 사이트 잠그기는 두 쿠키를 지우며 participant localStorage는 보존합니다. 관리자 잠그기는 관리자 쿠키만 지웁니다. SITE_SESSION_SECRET 교체 후 재배포하면 두 종류의 기존 세션이 모두 무효화됩니다.

비밀 값은 NEXT_PUBLIC_로 만들지 않습니다. 브라우저는 내부 API만 호출하고, Admin API는 사이트·관리자 세션, Origin과 입력값을 모두 확인합니다. Supabase SDK와 Secret key는 server-only입니다.

## Supabase migration

현재 운영 DB에 분기별 Poll migration까지 적용되어 있다면 다음 새 파일만 검토 후 Supabase SQL Editor에서 전체 실행하세요.

`supabase/migrations/20261023030000_poll_types_and_results.sql`

앱·스크립트는 migration을 자동 실행하지 않습니다. 기존 테이블, 숫자 ID, participant UUID, Poll·투표·댓글을 삭제하거나 초기화하지 않습니다. 기존 Poll은 `poll_type=choice`, `results_visibility=live`, `text_max_length=1000`으로 유지합니다. `votes.option_id`는 nullable이 되고 `text_response`, `updated_at`이 추가됩니다. 기존 선택지 ID와 객관식 표는 유지됩니다. 현재 분기·투표 기간·서버 전용 RLS 구조도 유지합니다.

새 CHECK·trigger와 주관식 전용 `(poll_id, participant_id)` 부분 UNIQUE가 응답 형태·길이·중복을 검사합니다. 주관식 등록과 수정, Admin 설정 변경은 같은 Poll 행 잠금을 사용합니다. 응답이 없는 Poll의 선택지를 수정하거나 유형을 바꾸면 사용되지 않은 선택지만 transaction 안에서 교체할 수 있습니다. 표가 있는 Poll의 유형·투표 방식·선택지는 고정합니다. 기존 응답보다 짧은 최대 글자 수는 거부합니다. 운영 DB에서 seed 재실행은 필요 없습니다.

새 DB 설치 순서:

1. `supabase/schema.sql`
2. `supabase/migrations/20261019_poll_slug.sql`
3. `supabase/migrations/20261021_participants_and_vote_modes.sql`
4. `supabase/seed_participants.sql`, `supabase/seed.sql`
5. `supabase/migrations/20261023000000_private_site_access.sql`
6. `supabase/migrations/20261023010000_poll_management.sql`
7. `supabase/migrations/20261023020000_poll_quarters.sql`
8. `supabase/migrations/20261023030000_poll_types_and_results.sql`

운영 DB에서 seed나 과거 schema·권한 migration을 반복 실행하지 마세요. 새 코드의 Poll 기능은 최신 migration이 필요하므로 배포와 함께 적용합니다. MDX와 참가자·댓글은 기존 구조를 유지합니다.

## 일상적인 Poll 관리

1. 사이트 비밀번호로 입장한 뒤 **ADMIN**에서 ADMIN_PASSWORD를 입력합니다.
2. **Create Poll**에서 필수 **Quarter**(기본 Current), 제목·설명, **객관식/주관식**을 선택합니다. 객관식은 선택지 2~20개(각 100자 이내)를 입력합니다.
3. 객관식은 **1인 1표** 또는 **중복 투표 가능**을 선택하고, 1인 1표에서 **투표 변경 허용**을 설정합니다. 주관식은 **1인 1응답**으로 고정되며 **응답 수정 허용**, **최대 응답 글자 수**(기본 1000, 10~5000)를 설정합니다.
4. **상시 투표**는 시작·종료가 null입니다. **기간 지정**은 한국 시간(Asia/Seoul)의 시작·종료를 입력합니다. 서버에서 UTC timestamptz로 변환하며 종료는 시작보다 늦어야 합니다.
5. **투표 만들기**는 DB transaction에서 Poll과 선택지를 함께 생성합니다. SQL Editor는 일상 운영에 필요하지 않습니다.
6. **Result Visibility**에서 **실시간 공개** 또는 **종료 후 공개**를 선택합니다. Edit에서도 바꿀 수 있습니다. **응답이 0개일 때만 Quarter·유형·투표 방식·선택지를 변경**할 수 있습니다. 제목·설명·기간·변경 허용·공개 정책·숨김은 계속 수정할 수 있습니다.
7. **Close/Reopen**은 수동 종료를 켜고 끕니다. 이미 종료일이 지난 Poll은 Reopen만으로 진행 상태가 되지 않으며 종료일도 수정해야 합니다.
8. **Hide/Unhide**는 일반 목록과 직접 참여 접근을 숨기거나 복원합니다. 데이터와 관리자 결과는 보존합니다. 삭제 UI/API는 없습니다.

DB 시각 기준 상태는 HIDDEN → 수동/기간 CLOSED → UPCOMING → ACTIVE 순서로 판단합니다. 진행 중 탭에는 예정된 투표도 안내하며 Home은 ACTIVE만 요약합니다. 종료된 Poll은 결과만 보여줍니다. 기간 경계의 투표 허용 여부는 브라우저 시각과 관계없이 DB가 검사합니다.

1인 1표는 선택된 participant_id 기준입니다. 변경 허용 시 같은 vote 행의 option_id를 바꾸며 표를 추가하지 않습니다. 중복 투표는 매번 별도 행을 추가하고 참여자 수와 총 표 수를 구분합니다. 과거 같은 사람의 중복 기록은 삭제하지 않으며, single Poll에 그런 기록이 있으면 선택 변경만 차단합니다.

## 결과 공개와 주관식 응답

- `live`: 진행 중에도 객관식 집계 또는 주관식 전체 응답을 공개합니다.
- `after_close`: 실제 기간 만료 또는 수동 Close 전까지 일반 목록·상세·결과 API에서 집계와 전체 응답을 null로 반환합니다. 참여자 수·총 표 수도 전달하지 않습니다. 다시 ACTIVE로 Reopen하면 다시 숨깁니다. Home은 공개 정책과 관계없이 응답 수를 표시하지 않습니다.
- DB의 `get_poll_detail`은 한 statement의 시각/스냅샷으로 공개 여부와 결과를 함께 계산합니다. Next.js 서버도 응답을 검사합니다. 일반 API에서 admin flag를 전달할 수 없습니다. Admin API는 별도 세션을 검사한 뒤 공개 정책과 관계없이 집계와 작성자·시각을 포함한 주관식 전체 응답을 반환합니다.
- 주관식은 trim 후 1~설정된 최대 글자 수이며 Unicode 문자 단위로 셉니다. 기존 응답이 있으면 수정 허용 시 같은 행만 UPDATE하고, 허용하지 않으면 거부합니다. 선택지는 필요하지 않습니다.
- 종료 전에도 내 응답은 별도 참여 조회로 볼 수 있습니다. 이름 선택을 현재 사이트 세션에 연결한 HttpOnly 서명 쿠키를 사용하므로 URL의 participant ID만 바꾼 조회는 거부합니다. localStorage의 기존 이름 저장은 유지합니다. 추가 환경변수나 개인별 로그인은 없습니다.

**이름 선택은 본인 인증이 아닙니다.** 내 응답은 현재 선택된 participant 기준입니다. 사용자가 이름 선택 자체를 다른 사람으로 바꾸는 것은 허용하므로 사람 단위 비밀 응답을 보장하지 않습니다. 기존 Comments는 Presentation의 자유 의견으로 유지되며 주관식 Poll과 통합하지 않습니다.

## 참가자와 댓글

Supabase Table Editor의 participants에서 display_name·display_order·is_active를 관리합니다. UUID를 보존한 채 이름을 바꾸면 기존 댓글에도 새 이름이 반영됩니다. 비활성 이름은 선택 목록에서 제외합니다. localStorage의 `project203_participant`와 이전 이름 값의 이관은 유지합니다.

이름 선택은 본인 인증이 아닙니다. 다른 이름을 선택할 수 있으므로 개인 신원을 검증하는 투표 시스템은 아닙니다. 댓글은 분기 Presentation에 유지하고, 현재 참가자 UUID로 앞뒤 공백 제거 후 1~1000자만 등록합니다. 댓글 수정·삭제는 추가하지 않습니다.

## 검증

```powershell
npm.cmd test
npm.cmd run check:supabase
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd run dev
```

Node 기본 test runner로 세션 경계·서명 변조·관리자/사이트 쿠키 분리·한국 시간 변환·필수 Quarter 입력·분기 정렬과 필터를 검사합니다. DB 진단은 서버 키로 조회만 하며 비밀 값과 데이터 본문을 출력하지 않습니다.

- 비밀번호 → participant → Home/Archive/Presentation/Polls를 확인합니다.
- 사이트 세션만으로 Admin API가 거부되고 별도 관리자 비밀번호로 관리 가능한지 확인합니다.
- 상시·기간·예정·종료·숨김, single/multiple, 선택 변경, 생성·수정·Close/Reopen/Hide/Unhide를 확인합니다.
- Current/과거 분기 목록 분리, 과거 분기 상시 투표, Quarter 필수/등록 검증, 투표 이후 분기 이동 차단을 확인합니다.
- 모바일에서 이름 선택·각 페이지·투표·생성/수정 폼과 가로 넘침을 확인합니다.
- DB 회귀 시험은 TEST DB에서 `supabase/tests/poll_management.sql`을 수동 실행합니다. fixture 행은 rollback됩니다. 자동 로컬 UI/API 시험의 모의 백엔드와 실제 PostgreSQL 검증을 구분합니다.
- 유형·공개 정책·주관식 DB 회귀 시험은 TEST DB에서 `supabase/tests/poll_types_and_results.sql`을 실행합니다. 일반 결과 API의 직접 호출, Close/Reopen과 기간 만료 공개, 본인 응답 범위, 주관식 중복·길이·수정 제한도 확인합니다.
- `supabase/tests/private_site_access.sql`은 공개 권한 회수 확인용입니다. 이전 anon 구조 전용 테스트는 private migration 이후 실행하지 않습니다.

## Vercel 배포

기존 다섯 환경변수를 Production 및 필요한 Preview 범위에서 유지하고, BOARD 작성용 `BOARD_PARTICIPANT_PASSWORDS`를 서버 Secret으로 추가합니다. 로컬도 같은 변수 이름을 사용합니다. 비밀번호 값은 환경별로 관리합니다.

최신 migration을 검토하고 SQL Editor에서 실행한 뒤 변경을 배포 브랜치에 commit/push합니다. 기존 Git 연동이 빌드·배포합니다. 환경변수만 변경해도 최신 Production Deployment에서 Redeploy가 필요합니다. 이전 공개 배포도 전환하거나 비활성화하세요. 사이트 접근부터 Admin 생성·투표·댓글까지 배포 URL에서 확인합니다.

공식 참고: [Next.js authentication](https://nextjs.org/docs/app/guides/authentication), [Supabase functions](https://supabase.com/docs/guides/database/functions), [PostgreSQL locking](https://www.postgresql.org/docs/current/explicit-locking.html).
