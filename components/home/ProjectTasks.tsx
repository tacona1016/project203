import Link from "next/link";
import { projectStatus } from "@/data/project-status";

export function ProjectTasks() {
  return <section className="home-tasks mb-16" aria-labelledby="tasks-title">
    <p className="eyebrow text-accent">지금 할 일</p>
    <h2 id="tasks-title" className="mt-4 text-2xl font-medium tracking-tight sm:text-3xl">같은 정보를 보고, 다음 행동을 정합니다.</h2>
    <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">{projectStatus?.nextAction ?? "프로젝트의 다음 행동은 아직 미정입니다. 발표자료와 의견을 살펴보고 함께 정합니다."}</p>
    <div className="mt-6 flex flex-wrap gap-3">
      <Link href="/polls?participation=pending" className="secondary-link">내 미참여 투표 →</Link>
      <Link href="/board" className="secondary-link">공지·의견 살펴보기 →</Link>
      <Link href="/archive" className="secondary-link">발표자료 보기 →</Link>
    </div>
  </section>;
}
