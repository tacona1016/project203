import Link from "next/link";
import { projectStatus, type ProjectStatus } from "@/data/project-status";
import { projectEventHref } from "@/data/project-plan";

export function ProjectTasks({ status = projectStatus }: { status?: ProjectStatus | null } = {}) {
  const links = status?.relatedLinks?.flatMap(link => {
    const href = projectEventHref(link.href);
    return href && link.label.trim() ? [{ ...link, href }] : [];
  }) ?? [];
  return <section className="home-tasks home-section" aria-labelledby="project-status-title" data-home-section="status">
    <div className="home-section-heading">
      <h2 id="project-status-title" className="home-section-title">프로젝트 현황과 다음 행동</h2>
      {status && <time className="text-xs text-muted" dateTime={status.updatedAt}>{status.updatedAt.replaceAll("-", ".")} 기준</time>}
    </div>
    {status ? <dl className="home-status-facts">
      <div><dt>현재 단계</dt><dd>{status.phase}</dd></div>
      {status.goal && status.goal !== status.nextAction && <div><dt>논의 목표</dt><dd>{status.goal}</dd></div>}
      <div><dt>다음 행동</dt><dd>{status.nextAction}</dd></div>
    </dl> : <p className="text-sm leading-7 text-muted">현재 프로젝트 단계와 다음 행동은 논의 후 업데이트됩니다.</p>}
    <div className="home-poll-links">
      {links.map(link => <Link key={link.href} href={link.href} className="text-link">{link.label} →</Link>)}
      <Link href="/board" className="text-link">의견 나누기 →</Link>
    </div>
  </section>;
}
