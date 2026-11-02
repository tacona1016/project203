import Link from "next/link";
import { getLatestBoardNotices } from "@/lib/board/notices";
import { formatKoreanDate } from "@/lib/polls";

export async function LatestNotices() {
  let notices;
  try { notices = await getLatestBoardNotices(); }
  catch {
    return <p className="interaction-notice" role="status">공지를 불러오지 못했습니다. 잠시 후 새로고침해주세요. <Link href="/board" className="text-link">게시판 확인 →</Link></p>;
  }
  if (!notices.length) return <p className="interaction-notice">아직 등록된 공지가 없습니다. 확정된 내용은 게시판 공지로 공유합니다.</p>;
  return <ul className="home-notice-list">
    {notices.map(notice => <li key={notice.id} className="border-t border-line py-6">
      <Link href={`/board/${notice.id}`} className="flex min-h-11 flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
        <span className="min-w-0"><span className="eyebrow mr-3 text-accent">{notice.is_pinned ? "고정 공지" : "공지"}</span><span className="font-medium wrap-anywhere">{notice.title}</span></span>
        <time className="shrink-0 text-xs text-muted" dateTime={notice.created_at}>{formatKoreanDate(notice.created_at)}</time>
      </Link>
    </li>)}
  </ul>;
}
