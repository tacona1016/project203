"use client";
import Link from "next/link";
import { useBoard } from "./BoardProvider";
import { boardReturnTo } from "@/lib/board/view";

export function BoardWriteLinks({ returnTo = "/board" }: { returnTo?: string }) {
  const { viewer } = useBoard();
  const query = new URLSearchParams({ returnTo: boardReturnTo(returnTo) });
  return <div className="board-write-links"><Link href={`/board/new?${query}`} className="interaction-button">글쓰기</Link>
    {viewer.isAdmin && <Link href={`/board/new?type=notice&${query}`} className="text-link">공지사항 작성</Link>}
  </div>;
}
