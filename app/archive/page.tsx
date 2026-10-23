import Link from "next/link";
import { SitePage } from "@/components/SitePage";
import { Arrow } from "@/components/Arrow";
import { getSortedQuarters } from "@/data/quarters";

export const metadata = { title: "Archive" };
export default function ArchivePage() {
  const quarters = getSortedQuarters();
  const years = [...new Set(quarters.map((item) => item.year))];
  return <SitePage label="THE COLLECTION" title="Archive" description="분기마다 기록하는 프로젝트의 방향과 진행사항.">
    <section aria-label="분기별 프레젠테이션" className="archive-section">
      {years.map((year) => <div key={year} className="archive-year">
        <h2 className="text-2xl font-medium">{year}</h2>
        <ul className="min-w-0">{quarters.filter((item) => item.year === year).map((item) => <li key={item.slug}>
          <Link href={`/quarter/${item.slug}`} className="archive-link group">
            <span className="text-xl font-medium">Q{item.quarter}</span>
            <span><span className="block font-medium">{item.title}</span><time dateTime={item.publishedAt} className="mt-2 block text-xs text-muted">{item.publishedAt.slice(0, 7).replace("-", ".")}</time><span className="mt-3 block text-xs text-accent">View Presentation</span></span>
            <Arrow direction="up-right" />
          </Link>
        </li>)}</ul>
      </div>)}
    </section>
  </SitePage>;
}
