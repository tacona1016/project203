# 203 PROJECT

분기마다 MDX 프레젠테이션을 추가하고 기존 자료를 Archive에 보관하는 웹사이트입니다. Next.js 16.4.2 App Router, TypeScript, Tailwind CSS 4, 공식 `@next/mdx`, npm을 사용합니다. 앱 코드는 모두 Server Component이며 별도의 상태 관리나 백엔드가 없습니다.

## 로컬 실행

Node.js 20.9 이상과 npm이 필요합니다. Node.js LTS 사용을 권장합니다.

```powershell
cd C:\project203
npm install
npm run dev
```

- 홈: http://localhost:3000
- 초기 프레젠테이션: http://localhost:3000/quarter/2026-q4

최초 설치에서 생성되는 `package-lock.json`은 저장소에 함께 보관하고, 이후 동일 환경을 재현할 때는 `npm ci`를 사용합니다. 초기 생성 환경(2026-10-19)에는 npm이 없고 외부 패키지 다운로드도 차단되어 있어 설치와 lockfile 생성은 수행하지 못했습니다.

```powershell
npm run lint
npm run typecheck
npm run build
npm run start
```

`typecheck`는 Next.js 라우트 타입을 먼저 생성하고 TypeScript를 검사합니다. `build`는 MDX 컴파일과 페이지의 프로덕션 빌드도 검사합니다. ESLint는 TypeScript·TSX·설정 파일을 검사하며, MDX는 빌드에서 검사합니다. 현재 환경에서는 위 명령의 성공 여부가 검증되지 않았습니다.

## 주요 파일

| 경로 | 역할 |
| --- | --- |
| `app/layout.tsx` | 한국어 문서, 공통 메타데이터, 본문 건너뛰기 링크 |
| `app/page.tsx` | 최신 분기 Current와 연도별 전체 Archive |
| `app/globals.css` | Tailwind 테마 토큰, 타이포그래피, 공통·반응형 스타일 |
| `app/quarter/2026-q4/page.mdx` | Cover부터 Next Step까지 여섯 섹션의 한국어 샘플 |
| `components/presentation/` | MDX용 Hero, Slide, SectionTitle, ImageBlock, TwoColumn, Presentation |
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

JSX 블록과 Markdown 본문 사이에는 빈 줄을 넣습니다. 짧은 본문은 Markdown으로 작성하고, 레이아웃이 필요한 곳에만 컴포넌트를 사용합니다. 표지의 h1 아래에는 SectionTitle의 h2, 세부 항목의 h3를 사용합니다. 기본 폰트는 시스템 폰트이며, 빌드 중 외부 폰트 다운로드가 필요하지 않습니다.

## 향후 기능을 추가할 위치

현재 DB, Supabase, 인증, 로그인, 투표, 설문, 의견 입력, API Route, Server Action, 관리자, Analytics, 사용자 상태 저장은 구현하지 않습니다.

추후 실제 요구가 정해지면 `lib/supabase/`에 서버·브라우저용 접근 코드를 분리하고, 기능별 UI와 필요한 라우트를 별도로 추가하면 됩니다. `components/presentation/`은 표현용으로 유지하고, 분기별 자료는 현재처럼 MDX로 관리할 수 있습니다. 현재는 해당 폴더나 연결 코드, 환경변수, 패키지를 생성하지 않습니다.

## 설정 참고

- [Next.js 설치 및 수동 구성](https://nextjs.org/docs/app/getting-started/installation)
- [Next.js 공식 MDX 가이드](https://nextjs.org/docs/app/guides/mdx)
- [Tailwind CSS의 Next.js 설정](https://tailwindcss.com/docs/installation/framework-guides/nextjs)
