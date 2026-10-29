"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useBoard } from "./BoardProvider";
import { boardInput, canManageBoardPost } from "@/lib/board/validation";
import { boardRequest } from "@/lib/board/client";
import type { BoardPost } from "@/lib/board/types";

export function BoardEditor({ initial, notice = false }: { initial?: BoardPost; notice?: boolean }) {
  const { viewer, loading } = useBoard();
  const [title, setTitle] = useState(initial?.title ?? ""), [content, setContent] = useState(initial?.content ?? "");
  const [type, setType] = useState(initial?.post_type ?? (notice ? "notice" : "general")), [pinned, setPinned] = useState(initial?.is_pinned ?? false);
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  const router = useRouter();
  const allowed = !loading && (viewer.isAdmin || viewer.verified) && (!initial || canManageBoardPost(initial, viewer));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!allowed || pending) return;
    let input;
    try { input = boardInput({ title, content, post_type: viewer.isAdmin ? type : "general", is_pinned: viewer.isAdmin && type === "notice" && pinned }); }
    catch (error) { setError((error as Error).message); return; }
    setPending(true); setError("");
    try {
      const result = await boardRequest<{ id: string | number }>(initial ? `/api/board/posts/${initial.id}` : "/api/board/posts", initial ? "PATCH" : "POST", input);
      router.push(`/board/${result.id}`); router.refresh();
    } catch (error) { setError((error as Error).message); setPending(false); }
  }
  return <form className="board-editor" onSubmit={submit} aria-busy={pending}>
    <fieldset disabled={!allowed || pending}>
      <legend className="sr-only">게시글 내용</legend>
      {viewer.isAdmin && <div className="board-editor-settings"><label htmlFor="board-post-type">게시글 유형</label>
        <select id="board-post-type" value={type} onChange={(event) => { setType(event.target.value as "general" | "notice"); if (event.target.value !== "notice") setPinned(false); }}>
          <option value="general">일반 게시글</option><option value="notice">공지사항</option>
        </select>
        {type === "notice" && <label className="board-check"><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} />게시판 상단에 고정</label>}
      </div>}
      <label htmlFor="board-title">제목</label><input id="board-title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={160} placeholder="이야기의 제목" />
      <label htmlFor="board-content">본문</label><textarea id="board-content" value={content} onChange={(event) => setContent(event.target.value)} rows={14} required maxLength={20000} placeholder="함께 나누고 싶은 이야기를 적어주세요." aria-describedby="board-content-count" />
      <p id="board-content-count" className="form-note mt-3">{Array.from(content).length} / 10000자</p>
      <div className="mt-8 flex flex-wrap gap-6 items-center"><button type="submit" className="interaction-button">{pending ? "저장 중..." : initial ? "수정 저장" : "게시글 등록"}</button><Link className="text-link" href={initial ? `/board/${initial.id}` : "/board"}>취소</Link></div>
    </fieldset>
    {!loading && !allowed && <p className="form-note mt-5">이 게시글을 작성하거나 수정할 권한이 없습니다.</p>}
    {error && <p className="form-error mt-5" role="alert">{error}</p>}
  </form>;
}
