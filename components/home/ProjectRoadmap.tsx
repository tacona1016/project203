import Link from "next/link";
import { projectRoadmap } from "@/data/project-plan";
import { findQuarter } from "@/data/quarters";

export function ProjectRoadmap() {
  const source = findQuarter("2026-q4");
  return <section className="home-roadmap pb-20 sm:pb-28" aria-labelledby="roadmap-title">
    <p className="eyebrow text-accent">장기 로드맵</p>
    <h2 id="roadmap-title" className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl">한 단계씩 준비합니다.</h2>
    <p className="mt-5 max-w-2xl text-sm leading-7 text-muted">2026 Q4 발표자료의 목표 일정입니다. 실제 착수·완료 여부나 확정된 진행률을 뜻하지 않으며, 토지와 자금 여건에 따라 다시 검토합니다.</p>
    <ol className="mt-9 grid gap-8 md:grid-cols-3">
      {projectRoadmap.map(step => <li key={step.phase} className="min-w-0 border-t border-line pt-6">
        <span className="eyebrow text-muted">PHASE {step.phase}</span>
        <h3 className="mt-3 text-xl font-medium">{step.title}</h3>
        <p className="mt-4 text-sm text-accent">목표 시점 · {step.target}</p>
        <p className="mt-3 text-sm leading-7 text-muted">{step.description}</p>
      </li>)}
    </ol>
    {source?.presentationPublished && <Link href="/quarter/2026-q4#roadmap" className="text-link mt-8">발표자료의 로드맵 보기 →</Link>}
  </section>;
}
