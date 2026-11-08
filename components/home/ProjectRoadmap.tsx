import Link from "next/link";
import { projectRoadmap } from "@/data/project-plan";
import { findQuarter } from "@/data/quarters";

export function ProjectRoadmap() {
  const source = findQuarter("2026-q4");
  return <section className="home-roadmap home-section" aria-labelledby="roadmap-title" data-home-section="roadmap">
    <h2 id="roadmap-title" className="home-section-title">장기 로드맵</h2>
    <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">2026 Q4 발표자료의 목표 일정입니다. 실제 착수·완료나 확정된 진행률을 뜻하지 않으며, 여건에 따라 다시 검토합니다.</p>
    <ol className="mt-5 grid gap-5 md:grid-cols-3">
      {projectRoadmap.map(step => <li key={step.phase} className="min-w-0 border-t border-line pt-4">
        <span className="eyebrow text-muted">PHASE {step.phase}</span>
        <h3 className="mt-2 text-lg font-medium">{step.title}</h3>
        <p className="mt-2 text-sm text-accent">목표 시점 · {step.target}</p>
        <p className="mt-2 text-sm leading-6 text-muted">{step.description}</p>
      </li>)}
    </ol>
    {source?.presentationPublished && <Link href="/quarter/2026-q4#roadmap" className="text-link mt-4">발표자료의 로드맵 보기 →</Link>}
  </section>;
}
