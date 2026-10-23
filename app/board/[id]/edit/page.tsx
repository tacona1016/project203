import Link from "next/link";
import { notFound } from "next/navigation";
import { SitePage } from "@/components/SitePage";
import { BoardIdentity } from "@/components/board/BoardIdentity";
import { BoardEditor } from "@/components/board/BoardEditor";
import { getBoardPost } from "@/lib/board/data";
import { getBoardViewer } from "@/lib/auth/board-session";
import { canManageBoardPost } from "@/lib/board/validation";
import { databaseId, HttpError } from "@/lib/auth/http";

export const metadata = { title: "게시글 수정" };
export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  let post;
  try { post = await getBoardPost(databaseId((await params).id)); } catch (error) {
    if (error instanceof HttpError && [400,404].includes(error.status)) notFound();
    return <SitePage label="BOARD / EDIT" title="게시글 수정"><p role="alert" className="interaction-notice">게시글을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p></SitePage>;
  }
  const viewer = await getBoardViewer();
  return <SitePage label="BOARD / EDIT" title="이야기 수정"><Link href={`/board/${post.id}`} className="text-link mb-8">← 게시글</Link><BoardIdentity />
    {canManageBoardPost(post, viewer) ? <BoardEditor initial={post} /> : <p className="interaction-notice">게시판 본인 확인을 마친 작성자 또는 관리자만 수정할 수 있습니다.</p>}
  </SitePage>;
}
