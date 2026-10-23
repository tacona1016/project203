import Link from "next/link";
import { SitePage } from "@/components/SitePage";
import { PrivateSiteImage } from "@/components/PrivateSiteImage";
import { BoardIdentity } from "@/components/board/BoardIdentity";
import { BoardWriteLinks } from "@/components/board/BoardWriteLinks";
import { getBoardPage } from "@/lib/board/data";
import { boardPage, boardSearch } from "@/lib/board/validation";
import { formatKoreanDate } from "@/lib/polls";
import type { BoardListItem } from "@/lib/board/types";
import { notFound } from "next/navigation";

export const metadata = { title: "Board" };
function PostRow({ post }: { post: BoardListItem }) {
  return <li className="board-row"><Link href={`/board/${post.id}`} className="board-row-title">{post.post_type === "notice" && <span className="board-notice-badge">NOTICE</span>}<span>{post.title}</span><span className="board-comment-count" aria-label={`댓글 ${post.comment_count}개`}>{post.comment_count}</span></Link>
    <div className="board-row-meta"><span>{post.author_name}</span><time dateTime={post.created_at}>{formatKoreanDate(post.created_at)}</time></div>
  </li>;
}
export default async function BoardPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams; let search, page;
  try { search = boardSearch(params.q); page = boardPage(params.page); } catch { notFound(); }
  const data = await getBoardPage(search, page).catch(() => null);
  const last = data ? Math.max(1, Math.ceil(data.total / 10)) : 1;
  const href = (number: number) => `/board?${new URLSearchParams({ ...(search ? { q: search } : {}), page: String(number) })}`;
  return <SitePage label="OUR COMMON GROUND" title="자유게시판" description="프로젝트 이야기부터 일상의 생각까지, 함께 나누는 공간입니다." beforeHeading={<div className="board-banner"><PrivateSiteImage image="boardBanner" alt="친구들과 함께 나누는 공간의 풍경" /><span>203 PROJECT / SHARED STORIES</span></div>}>
    <BoardIdentity />
    <div className="board-toolbar"><form action="/board" method="GET" className="board-search"><label htmlFor="board-search" className="sr-only">제목 및 본문 검색</label><input id="board-search" name="q" type="search" defaultValue={search} maxLength={100} placeholder="제목·본문 검색" /><button type="submit" className="text-link">검색</button>{search && <Link href="/board" className="text-link">초기화</Link>}</form><BoardWriteLinks /></div>
    {!data ? <p className="interaction-notice" role="alert">게시판을 준비하고 있습니다. 잠시 후 다시 확인해주세요.</p> : <>
      {!!data.pinned.length && <section aria-labelledby="board-notices"><h2 id="board-notices" className="eyebrow mb-5 text-accent">NOTICE · 고정 공지사항</h2><ul className="board-pinned">{data.pinned.map((post) => <PostRow key={post.id} post={post} />)}</ul></section>}
      <section aria-label="게시글 목록" className="mt-10"><p className="form-note mb-5">{search ? `‘${search}’ 검색 결과` : "최근 이야기"} · {data.total}개{data.pinned.length ? ` · 고정 공지 ${data.pinned.length}개 별도` : ""}</p>
        <ul className="board-post-list">{data.posts.map((post) => <PostRow key={post.id} post={post} />)}</ul>
        {!data.posts.length && <p className="interaction-notice">{search ? "검색 결과가 없습니다." : "아직 등록된 일반 게시글이 없습니다."}</p>}
      </section>
      <nav className="board-pagination" aria-label="게시글 페이지"><Link href={href(Math.max(1, page - 1))} aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined}>← 이전</Link><span>{page} / {last}</span><Link href={href(Math.min(last, page + 1))} aria-disabled={page >= last} tabIndex={page >= last ? -1 : undefined}>다음 →</Link></nav>
    </>}
  </SitePage>;
}
