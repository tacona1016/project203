import { getProjectHome } from "@/lib/project/data";
import { ProjectTasks } from "./ProjectTasks";
import { UpcomingEvents } from "./UpcomingEvents";

export async function ProjectStatusSection() {
  const home = await getProjectHome();
  if (home.source === "unavailable") return <section className="home-section home-empty-section" data-home-section="status"><p className="interaction-notice" role="status">프로젝트 현황을 불러오지 못했습니다. 잠시 후 다시 확인해주세요.</p></section>;
  return <ProjectTasks status={home.status} />;
}
export async function ProjectEventsSection() {
  const home = await getProjectHome();
  // An outage has already been reported by the status section; don't repeat it.
  if (home.source === "unavailable") return null;
  return <UpcomingEvents entries={home.events} />;
}
