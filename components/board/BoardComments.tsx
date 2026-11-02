"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { boardRequest } from "@/lib/board/client";
import { boardCommentInput, boardTextLength, BOARD_COMMENT_PAGE_SIZE, BOARD_LIMITS } from "@/lib/board/validation";
import { formatKoreanDate } from "@/lib/polls";
import type { BoardComment } from "@/lib/board/types";
import type { DatabaseId } from "@/lib/supabase/types";
import { useBoard } from "./BoardProvider";
import { BoardBody } from "./BoardBody";

export function BoardComments({ postId, initial, count }: { postId: DatabaseId; initial: BoardComment[]; count: number }) {
  const { viewer, loading } = useBoard(), router = useRouter();
  const [comments, setComments] = useState(initial), [page, setPage] = useState(1), [hasMore, setHasMore] = useState(count > initial.length);
  const [content, setContent] = useState(""), [pending, setPending] = useState(false), [error, setError] = useState("");
  const [editing, setEditing] = useState<DatabaseId | null>(null), [editContent, setEditContent] = useState(""), [message, setMessage] = useState("");
  const writing = useRef(false);
  const [total, setTotal] = useState(count);
  const allowed = !loading && (viewer.isAdmin || viewer.verified);
  const contentLength = boardTextLength(content), contentTooLong = contentLength > BOARD_LIMITS.comment;
  const url = `/api/board/posts/${postId}/comments`;
  async function refresh() { const data = await boardRequest<BoardComment[]>(url); setComments(data); setPage(1); setHasMore(data.length === BOARD_COMMENT_PAGE_SIZE); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending || writing.current || !allowed) return;
    let input; try { input = boardCommentInput({ content }); } catch (error) { setError((error as Error).message); return; }
    writing.current = true; setPending(true); setError(""); setMessage("");
    try { await boardRequest(url, "POST", { content: input }); setContent(""); setTotal((value) => value + 1);
      setMessage("댓글이 등록되었습니다.");
      try { await refresh(); router.refresh(); } catch { setError("댓글은 등록되었지만 목록을 불러오지 못했습니다. 새로고침해주세요."); }
    } catch (error) { setError((error as Error).message); } finally { writing.current = false; setPending(false); }
  }
  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending || writing.current || editing === null || !allowed) return;
    let value; try { value = boardCommentInput({ content: editContent }); } catch (error) { setError((error as Error).message); return; }
    writing.current = true; setPending(true); setError(""); setMessage("");
    try {
      const saved = await boardRequest<{ id: DatabaseId; content: string; updated_at: string }>(`${url}/${editing}`, "PATCH", { content: value });
      setComments(current => current.map(comment => String(comment.id) === String(saved.id) ? { ...comment, content: saved.content, updated_at: saved.updated_at } : comment));
      setEditing(null); setEditContent(""); setMessage("댓글 수정이 저장되었습니다."); router.refresh();
    } catch (error) { setError((error as Error).message); }
    finally { writing.current = false; setPending(false); }
  }
  async function remove(id: DatabaseId) {
    if (pending || writing.current || !window.confirm("이 댓글을 삭제할까요?")) return;
    writing.current = true; setPending(true); setError(""); setMessage("");
    try { await boardRequest(`${url}/${id}`, "DELETE"); setComments((values) => values.filter((value) => value.id !== id)); setTotal((value) => value - 1);
      if (String(editing) === String(id)) setEditing(null);
      setMessage("댓글이 삭제되었습니다.");
      try { await refresh(); router.refresh(); } catch { setError("댓글은 삭제되었지만 목록을 불러오지 못했습니다. 새로고침해주세요."); }
    } catch (error) { setError((error as Error).message); } finally { writing.current = false; setPending(false); }
  }
  async function more() {
    if (pending) return; setPending(true); setError("");
    try { const data = await boardRequest<BoardComment[]>(`${url}?page=${page + 1}`); setComments((current) => [...current, ...data.filter((item) => !current.some((old) => old.id === item.id))]); setPage((value) => value + 1); setHasMore(data.length === BOARD_COMMENT_PAGE_SIZE); }
    catch (error) { setError((error as Error).message); } finally { setPending(false); }
  }
  return <section className="board-comments" aria-labelledby="board-comments-title"><h2 id="board-comments-title">댓글 <span>{total}</span></h2>
    <ul>{comments.map((comment) => <li key={comment.id}>
      <div className="board-comment-meta"><strong>{comment.author_name}</strong><span>작성 <time dateTime={comment.created_at}>{formatKoreanDate(comment.created_at)}</time></span>
        {comment.updated_at !== comment.created_at && <span className="text-xs text-muted">수정 <time dateTime={comment.updated_at}>{formatKoreanDate(comment.updated_at)}</time></span>}
        {allowed && viewer.participantId === comment.author_id && <button type="button" className="text-link" disabled={pending || editing !== null} onClick={() => { setEditing(comment.id); setEditContent(comment.content); setError(""); setMessage(""); }}>수정</button>}
        {allowed && (viewer.isAdmin || viewer.participantId === comment.author_id) && <button type="button" className="text-link" disabled={pending} onClick={() => remove(comment.id)}>삭제</button>}
      </div>{String(editing) === String(comment.id) ? <form onSubmit={saveEdit} className="board-comment-edit" aria-busy={pending}>
        <label htmlFor={`board-comment-edit-${comment.id}`} className="sr-only">내 댓글 수정</label>
        <textarea id={`board-comment-edit-${comment.id}`} rows={4} value={editContent} onChange={event => setEditContent(event.target.value)} disabled={pending} required aria-invalid={boardTextLength(editContent) > BOARD_LIMITS.comment} aria-describedby={`board-comment-edit-count-${comment.id}`} />
        <p id={`board-comment-edit-count-${comment.id}`} className="form-note mt-3">{boardTextLength(editContent)} / {BOARD_LIMITS.comment}자</p>
        <div className="mt-4 flex flex-wrap gap-5"><button className="interaction-button" type="submit" disabled={pending || !boardTextLength(editContent) || boardTextLength(editContent) > BOARD_LIMITS.comment}>{pending ? "저장 중..." : "수정 저장"}</button><button className="text-link" type="button" disabled={pending} onClick={() => { setEditing(null); setEditContent(""); setError(""); }}>수정 취소</button></div>
      </form> : <BoardBody>{comment.content}</BoardBody>}
    </li>)}</ul>
    {!comments.length && <p className="form-note py-6">첫 번째 이야기를 남겨주세요.</p>}
    {hasMore && <button type="button" className="text-link my-6" disabled={pending} onClick={more}>{pending ? "불러오는 중..." : "댓글 더 보기"}</button>}
    <form onSubmit={submit} aria-busy={pending} className="mt-10"><label htmlFor="board-comment">댓글 남기기</label>
      <textarea id="board-comment" rows={4} required value={content} disabled={pending || !allowed} onChange={(event) => setContent(event.target.value)} placeholder={allowed ? "함께 나누고 싶은 의견을 적어주세요." : "로그인한 회원만 댓글을 남길 수 있습니다."} aria-describedby="board-comment-count board-comment-policy" aria-invalid={contentTooLong} />
      <div className="mt-4 flex flex-wrap justify-between items-center gap-4"><span id="board-comment-count" className={`form-note tabular-nums ${contentTooLong ? "text-red-700" : ""}`}>{contentLength} / {BOARD_LIMITS.comment}자{contentTooLong && " · 댓글을 줄여주세요."}</span><button type="submit" className="interaction-button" disabled={pending || !allowed || !contentLength || contentTooLong}>{pending ? "처리 중..." : "댓글 등록"}</button></div>
      <p id="board-comment-policy" className="form-note mt-2">앞뒤 공백 제외 · 줄바꿈 포함. 이모지 조합은 여러 글자로 셀 수 있습니다.</p>
    </form>{message && <p className="form-feedback mt-5" role="status">{message}</p>}{error && <p className="form-error mt-5" role="alert">{error}</p>}
  </section>;
}
