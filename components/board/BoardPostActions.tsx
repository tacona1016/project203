"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useBoard } from "./BoardProvider";
import { canManageBoardPost } from "@/lib/board/validation";
import { boardRequest } from "@/lib/board/client";
import type { BoardPost } from "@/lib/board/types";

export function BoardPostActions({ post }: { post: BoardPost }) {
  const { viewer, loading } = useBoard(), router = useRouter();
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  if (loading || !canManageBoardPost(post, viewer)) return null;
  async function remove() {
    if (pending || !window.confirm("이 게시글을 삭제할까요?")) return;
    setPending(true); setError("");
    try { await boardRequest(`/api/board/posts/${post.id}`, "DELETE"); router.push("/board"); router.refresh(); }
    catch (error) { setError((error as Error).message); setPending(false); }
  }
  return <div className="board-post-actions"><Link href={`/board/${post.id}/edit`} className="text-link">{viewer.isAdmin ? "수정 · 공지 설정" : "수정"}</Link>
    <button className="text-link" type="button" disabled={pending} onClick={remove}>{pending ? "삭제 중..." : "삭제"}</button>
    {error && <p role="alert" className="form-error">{error}</p>}
  </div>;
}
