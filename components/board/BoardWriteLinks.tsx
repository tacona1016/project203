"use client";
import Link from "next/link";
import { useBoard } from "./BoardProvider";

export function BoardWriteLinks() {
  const { viewer } = useBoard();
  return <div className="board-write-links"><Link href="/board/new" className="interaction-button">글쓰기</Link>
    {viewer.isAdmin && <Link href="/board/new?type=notice" className="text-link">공지사항 작성</Link>}
  </div>;
}
