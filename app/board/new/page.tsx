import Link from "next/link";
import { SitePage } from "@/components/SitePage";
import { BoardIdentity } from "@/components/board/BoardIdentity";
import { BoardEditor } from "@/components/board/BoardEditor";
import { boardReturnTo } from "@/lib/board/view";

export const metadata = { title: "게시글 작성" };
export default async function NewPostPage({ searchParams }: { searchParams: Promise<{ type?: string; returnTo?: string }> }) {
  const query = await searchParams, returnTo = boardReturnTo(query.returnTo);
  return <SitePage label="BOARD / WRITE" title="새로운 이야기"><Link href={returnTo} className="text-link mb-8">← 자유게시판</Link><BoardIdentity /><BoardEditor notice={query.type === "notice"} returnTo={returnTo} /></SitePage>;
}
