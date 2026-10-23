import Link from "next/link";
import { SitePage } from "@/components/SitePage";
import { BoardIdentity } from "@/components/board/BoardIdentity";
import { BoardEditor } from "@/components/board/BoardEditor";

export const metadata = { title: "게시글 작성" };
export default async function NewPostPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  return <SitePage label="BOARD / WRITE" title="새로운 이야기"><Link href="/board" className="text-link mb-8">← 자유게시판</Link><BoardIdentity /><BoardEditor notice={(await searchParams).type === "notice"} /></SitePage>;
}
