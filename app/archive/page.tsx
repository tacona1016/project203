import Link from "next/link";
import { SitePage } from "@/components/SitePage";
import { Arrow } from "@/components/Arrow";
import { getPublishedQuarters } from "@/data/quarters";

export const metadata = { title: "발표자료" };
export default async function ArchivePage({ searchParams }: { searchParams: Promise<{ q?: string; year?: string }> }) {
  const query = await searchParams;
  const search = typeof query.q === "string" ? query.q.trim().slice(0, 100) : "";
  const all = getPublishedQuarters();
  const allYears = [...new Set(all.map(item => item.year))];
  const year = typeof query.year === "string" && allYears.some(value => String(value) === query.year) ? query.year : "";
  const quarters = all.filter(item => (!year || String(item.year) === year)
    && (!search || `${item.year} Q${item.quarter} ${item.title} ${item.description}`.toLocaleLowerCase("ko-KR").includes(search.toLocaleLowerCase("ko-KR"))));
  const years = [...new Set(quarters.map((item) => item.year))];
  return <SitePage label="ARCHIVE" title="발표자료" description="분기별 프로젝트의 방향과 진행 기록.">
    <details className="archive-filter-panel" open={!!search || !!year || all.length > 6}>
      <summary>발표자료 찾기 <span className="text-muted">· 검색 및 연도</span></summary>
    <form action="/archive" method="get" className="archive-filters" role="search" aria-label="발표자료 검색">
      <div><label htmlFor="archive-search">발표자료 찾기</label><input id="archive-search" name="q" type="search" defaultValue={search} maxLength={100} placeholder="제목, 주제 또는 분기" /></div>
      <div><label htmlFor="archive-year">연도</label><select id="archive-year" name="year" defaultValue={year}><option value="">모든 연도</option>{allYears.map(value => <option key={value} value={value}>{value}년</option>)}</select></div>
      <button type="submit" className="interaction-button">검색</button>
      {(search || year) && <Link href="/archive" className="text-link">조건 초기화</Link>}
    </form>
    </details>
    <p className="mt-4 mb-5 text-sm text-muted">공개된 발표자료 {quarters.length}개{search && ` · “${search}” 검색 결과`}</p>
    <section aria-label="분기별 프레젠테이션" className="archive-section">
      {!quarters.length && <div className="interaction-notice"><p>{all.length ? "검색 조건에 맞는 발표자료가 없습니다." : "아직 공개된 프레젠테이션이 없습니다."}</p>{all.length > 0 && <Link href="/archive" className="text-link mt-4">전체 발표자료 보기 →</Link>}</div>}
      {years.map((year) => <div key={year} className="archive-year">
        <h2 className="text-2xl font-medium">{year}</h2>
        <ul className="min-w-0">{quarters.filter((item) => item.year === year).map((item) => <li key={item.slug}>
          <Link href={`/quarter/${item.slug}`} className="archive-link group">
            <span className="text-xl font-medium">Q{item.quarter}</span>
            <span><span className="block font-medium">{item.title}</span><time dateTime={item.publishedAt} className="mt-2 block text-xs text-muted">{item.publishedAt.slice(0, 7).replace("-", ".")}</time><span className="mt-3 block text-xs text-accent">발표자료 읽기</span></span>
            <Arrow direction="up-right" />
          </Link>
        </li>)}</ul>
      </div>)}
    </section>
  </SitePage>;
}
