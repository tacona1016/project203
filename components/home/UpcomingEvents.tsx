import Link from "next/link";
import { getUpcomingProjectEvents, projectEventHref } from "@/data/project-plan";
import { formatKoreanDate } from "@/lib/polls";

export function UpcomingEvents() {
  const events = getUpcomingProjectEvents();
  return <section className="home-upcoming pb-20 sm:pb-28" aria-labelledby="upcoming-title">
    <p className="eyebrow text-accent">공동 일정</p>
    <h2 id="upcoming-title" className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl">다음에 만날 때.</h2>
    {!events.length ? <p className="interaction-notice mt-7">아직 확정된 예정 일정이 없습니다. 모임과 답사 일정은 합의 후 등록합니다. 투표 마감은 위 투표 영역에서 확인할 수 있습니다.</p> : <ul className="mt-7">
      {events.map(event => {
        const href = projectEventHref(event.href);
        return <li key={event.id} className="border-t border-line py-6">
          <time dateTime={event.startsAt} className="text-sm text-accent">{formatKoreanDate(event.startsAt)} · 한국 시간</time>
          <h3 className="mt-3 text-lg font-medium wrap-anywhere">{href ? <Link href={href} className="hover:text-accent">{event.title} →</Link> : event.title}</h3>
          {event.location && <p className="mt-2 text-sm text-muted wrap-anywhere">{event.location}</p>}
        </li>;
      })}
    </ul>}
  </section>;
}
