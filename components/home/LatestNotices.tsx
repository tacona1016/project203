import Link from "next/link";
import { getLatestBoardNotices, getHomeDecisionNotices } from "@/lib/board/notices";
import { formatKoreanDate } from "@/lib/polls";

export async function HomeBoardUpdates() {
  const [notices, decisions] = await Promise.allSettled([getLatestBoardNotices(), getHomeDecisionNotices()]);
  const decisionIds = new Set(decisions.status === "fulfilled" ? decisions.value.map(notice => String(notice.id)) : []);
  const otherNotices = notices.status === "fulfilled" ? notices.value.filter(notice => !decisionIds.has(String(notice.id))) : [];
  if (notices.status === "rejected" && decisions.status === "rejected") {
    return <section className="home-section home-empty-section" data-home-section="notices" aria-label="공지와 결정 조회 안내">
      <p className="interaction-notice" role="status">공지와 결정사항을 불러오지 못했습니다. 잠시 후 다시 확인해주세요. <Link href="/board" className="text-link">게시판 확인 →</Link></p>
    </section>;
  }
  return <>
    {decisions.status === "rejected" ? <section className="home-section home-empty-section" data-home-section="decisions" aria-label="결정 조회 안내"><p className="interaction-notice" role="status">결정사항을 불러오지 못했습니다. 잠시 후 다시 확인해주세요.</p></section>
      : decisions.value.length > 0 && <section className="home-section" data-home-section="decisions" aria-labelledby="recent-decisions-title">
        <h2 id="recent-decisions-title" className="home-section-title">최근 결정사항</h2>
        <p className="text-xs text-muted mt-2">확정된 공지로 직접 등록한 기록입니다. 투표 결과와 최종 합의는 별개입니다.</p>
        <ul className="home-notice-list mt-3">{decisions.value.map(notice => <li key={notice.id} className="border-t border-line py-3">
          <Link href={`/board/${notice.id}`} className="text-link font-medium wrap-anywhere">{notice.title} →</Link>
          <p className="text-xs text-muted mt-1">공지 등록 <time dateTime={notice.created_at}>{formatKoreanDate(notice.created_at)}</time></p>
          {notice.polls.map(poll => <Link key={poll.slug} href={`/polls/${poll.slug}`} className="text-link text-xs mr-4">관련 투표 · {poll.title} →</Link>)}
          {notice.pollsUnavailable && <p className="text-xs text-muted" role="status">관련 투표 링크를 불러오지 못했습니다.</p>}
        </li>)}</ul>
      </section>}
    {notices.status === "rejected" ? <section className="home-section home-empty-section" data-home-section="notices" aria-label="공지 조회 안내"><p className="interaction-notice" role="status">공지를 불러오지 못했습니다. 잠시 후 다시 확인해주세요. <Link href="/board" className="text-link">게시판 확인 →</Link></p></section>
      : otherNotices.length > 0 && <section className="home-section" data-home-section="notices" aria-labelledby="latest-notices-title">
        <div className="home-section-heading"><h2 id="latest-notices-title" className="home-section-title">최신 공지</h2><Link href="/board" className="text-link">게시판 전체 →</Link></div>
        <NoticeList notices={otherNotices} />
      </section>}
  </>;
}

function NoticeList({ notices }: { notices: Awaited<ReturnType<typeof getLatestBoardNotices>> }) {
  return <ul className="home-notice-list">
    {notices.map(notice => <li key={notice.id} className="border-t border-line py-3">
      <Link href={`/board/${notice.id}`} className="flex min-h-11 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <span className="min-w-0"><span className="eyebrow mr-3 text-accent">{notice.is_pinned ? "고정 공지" : "공지"}</span><span className="font-medium wrap-anywhere">{notice.title}</span></span>
        <time className="shrink-0 text-xs text-muted" dateTime={notice.created_at}>{formatKoreanDate(notice.created_at)}</time>
      </Link>
    </li>)}
  </ul>;
}
