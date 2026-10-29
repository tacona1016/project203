"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { boardRequest } from "@/lib/board/client";
import { boardCommentInput, BOARD_COMMENT_PAGE_SIZE } from "@/lib/board/validation";
import { formatKoreanDate } from "@/lib/polls";
import type { BoardComment } from "@/lib/board/types";
import type { DatabaseId } from "@/lib/supabase/types";
import { useBoard } from "./BoardProvider";

export function BoardComments({ postId, initial, count }: { postId: DatabaseId; initial: BoardComment[]; count: number }) {
  const { viewer, loading } = useBoard(), router = useRouter();
  const [comments, setComments] = useState(initial), [page, setPage] = useState(1), [hasMore, setHasMore] = useState(count > initial.length);
  const [content, setContent] = useState(""), [pending, setPending] = useState(false), [error, setError] = useState("");
  const [total, setTotal] = useState(count);
  const allowed = !loading && (viewer.isAdmin || viewer.verified);
  const url = `/api/board/posts/${postId}/comments`;
  async function refresh() { const data = await boardRequest<BoardComment[]>(url); setComments(data); setPage(1); setHasMore(data.length === BOARD_COMMENT_PAGE_SIZE); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending || !allowed) return;
    let input; try { input = boardCommentInput({ content }); } catch (error) { setError((error as Error).message); return; }
    setPending(true); setError("");
    try { await boardRequest(url, "POST", { content: input }); setContent(""); setTotal((value) => value + 1);
      try { await refresh(); router.refresh(); } catch { setError("댓글은 등록되었지만 목록을 불러오지 못했습니다. 새로고침해주세요."); }
    } catch (error) { setError((error as Error).message); } finally { setPending(false); }
  }
  async function remove(id: DatabaseId) {
    if (pending || !window.confirm("이 댓글을 삭제할까요?")) return;
    setPending(true); setError("");
    try { await boardRequest(`${url}/${id}`, "DELETE"); setComments((values) => values.filter((value) => value.id !== id)); setTotal((value) => value - 1);
      try { await refresh(); router.refresh(); } catch { setError("댓글은 삭제되었지만 목록을 불러오지 못했습니다. 새로고침해주세요."); }
    } catch (error) { setError((error as Error).message); } finally { setPending(false); }
  }
  async function more() {
    if (pending) return; setPending(true); setError("");
    try { const data = await boardRequest<BoardComment[]>(`${url}?page=${page + 1}`); setComments((current) => [...current, ...data.filter((item) => !current.some((old) => old.id === item.id))]); setPage((value) => value + 1); setHasMore(data.length === BOARD_COMMENT_PAGE_SIZE); }
    catch (error) { setError((error as Error).message); } finally { setPending(false); }
  }
  return <section className="board-comments" aria-labelledby="board-comments-title"><h2 id="board-comments-title">댓글 <span>{total}</span></h2>
    <ul>{comments.map((comment) => <li key={comment.id}>
      <div className="board-comment-meta"><strong>{comment.author_name}</strong><time dateTime={comment.created_at}>{formatKoreanDate(comment.created_at)}</time>
        {allowed && (viewer.isAdmin || viewer.participantId === comment.author_id) && <button type="button" className="text-link" disabled={pending} onClick={() => remove(comment.id)}>삭제</button>}
      </div><p className="board-body">{comment.content}</p>
    </li>)}</ul>
    {!comments.length && <p className="form-note py-6">첫 번째 이야기를 남겨주세요.</p>}
    {hasMore && <button type="button" className="text-link my-6" disabled={pending} onClick={more}>{pending ? "불러오는 중..." : "댓글 더 보기"}</button>}
    <form onSubmit={submit} aria-busy={pending} className="mt-10"><label htmlFor="board-comment">댓글 남기기</label>
      <textarea id="board-comment" rows={4} required value={content} maxLength={4000} disabled={pending || !allowed} onChange={(event) => setContent(event.target.value)} placeholder={allowed ? "함께 나누고 싶은 의견을 적어주세요." : "로그인한 회원만 댓글을 남길 수 있습니다."} />
      <div className="mt-4 flex flex-wrap justify-between items-center gap-4"><span className="form-note">{Array.from(content).length} / 2000자</span><button type="submit" className="interaction-button" disabled={pending || !allowed || !content.trim()}>{pending ? "처리 중..." : "댓글 등록"}</button></div>
    </form>{error && <p className="form-error mt-5" role="alert">{error}</p>}
  </section>;
}
