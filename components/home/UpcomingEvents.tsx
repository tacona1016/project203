import Link from "next/link";
import { getUpcomingProjectEvents, projectEventHref, type ProjectEvent } from "@/data/project-plan";
import { formatKoreanDate } from "@/lib/polls";

export function UpcomingEvents({ entries }: { entries?: readonly ProjectEvent[] } = {}) {
  const events = getUpcomingProjectEvents(entries);
  if (!events.length) return null;
  return <section className="home-upcoming home-section" aria-labelledby="upcoming-title" data-home-section="events">
    <h2 id="upcoming-title" className="home-section-title">공동 일정</h2>
    <ul className="mt-4">
      {events.map(event => {
        const href = projectEventHref(event.href);
        return <li key={event.id} className="border-t border-line py-4">
          <time dateTime={event.startsAt} className="text-sm text-accent">{formatKoreanDate(event.startsAt)} · 한국 시간</time>
          <h3 className="mt-3 text-lg font-medium wrap-anywhere">{href ? <Link href={href} className="hover:text-accent">{event.title} →</Link> : event.title}</h3>
          {event.location && <p className="mt-2 text-sm text-muted wrap-anywhere">{event.location}</p>}
        </li>;
      })}
    </ul>
  </section>;
}
