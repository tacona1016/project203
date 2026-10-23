import Link from "next/link";
import { notFound } from "next/navigation";
import { SitePage } from "@/components/SitePage";
import { BoardIdentity } from "@/components/board/BoardIdentity";
import { BoardPostActions } from "@/components/board/BoardPostActions";
import { BoardComments } from "@/components/board/BoardComments";
import { getBoardComments, getBoardPost } from "@/lib/board/data";
import { databaseId, HttpError } from "@/lib/auth/http";
import { formatKoreanDate } from "@/lib/polls";

export const metadata = { title: "게시글" };
export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  let post;
  try { post = await getBoardPost(databaseId((await params).id)); } catch (error) {
    if (error instanceof HttpError && [400,404].includes(error.status)) notFound();
    return <SitePage label="BOARD" title="게시글"><p className="interaction-notice" role="alert">게시글을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p><Link href="/board" className="text-link mt-8">← 자유게시판</Link></SitePage>;
  }
  const comments = await getBoardComments(post.id).catch(() => null);
  return <SitePage label={post.post_type === "notice" ? "BOARD / NOTICE" : "BOARD / STORY"} title={post.title}>
    <Link href="/board" className="text-link mb-8">← 자유게시판</Link>
    <article className="board-post"><div className="board-post-meta">{post.post_type === "notice" && <span className="board-notice-badge">{post.is_pinned ? "NOTICE · 고정" : "NOTICE"}</span>}<strong>{post.author_name}</strong>
      <span>작성 <time dateTime={post.created_at}>{formatKoreanDate(post.created_at)}</time></span>{post.updated_at !== post.created_at && <span>수정 <time dateTime={post.updated_at}>{formatKoreanDate(post.updated_at)}</time></span>}
    </div><p className="board-body board-post-content">{post.content}</p><BoardPostActions post={post} /></article>
    <BoardIdentity />
    {comments ? <BoardComments postId={post.id} initial={comments} count={post.comment_count} /> : <p className="interaction-notice" role="alert">댓글을 불러오지 못했습니다. 페이지를 새로고침해주세요.</p>}
  </SitePage>;
}
