"use client";

import { useState } from "react";
import { COMMENTS_PAGE_SIZE, getComments, insertComment } from "@/lib/site-api";
import type { Comment } from "@/lib/supabase/types";
import { CommentForm } from "./CommentForm";
import { CommentList } from "./CommentList";

export function Comments({ quarter, initialComments }: { quarter: string; initialComments: Comment[] | null }) {
  const [comments, setComments] = useState(initialComments ?? []);
  const [hasMore, setHasMore] = useState(initialComments?.length === COMMENTS_PAGE_SIZE);
  const [loaded, setLoaded] = useState(initialComments !== null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(initialComments ? "" : "의견을 불러오지 못했습니다. 다시 시도해주세요.");

  async function refresh(append = false) {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const next = await getComments(quarter, append ? comments.length : 0);
      setComments(append ? [...comments, ...next.filter((item) => !comments.some((previous) => previous.id === item.id))] : next);
      setHasMore(next.length === COMMENTS_PAGE_SIZE);
      setLoaded(true);
    } catch {
      setError("의견을 불러오지 못했습니다. 다시 시도해주세요.");
    } finally {
      setPending(false);
    }
  }

  async function submit(content: string) {
    if (pending) return false;
    setPending(true);
    setError("");
    setMessage("");
    let saved: Comment;
    try {
      saved = await insertComment(quarter, content);
    } catch {
      setError("등록에 실패했습니다. 다시 시도해주세요.");
      setPending(false);
      return false;
    }

    setComments((current) => [saved, ...current]);
    setLoaded(true);
    setMessage("댓글이 등록되었습니다.");
    try {
      const latest = await getComments(quarter);
      setComments(latest);
      setHasMore(latest.length === COMMENTS_PAGE_SIZE);
    } catch {
      setError("댓글은 저장되었지만 최신 목록을 불러오지 못했습니다. 목록을 다시 불러와주세요.");
    } finally {
      setPending(false);
    }
    return true;
  }

  return (
    <div className="max-w-3xl">
      <CommentForm pending={pending} onSubmit={submit} />
      <p role="status" className="form-feedback">{message}</p>
      {error && <div className="form-error" role="alert">
        <p>{error}</p>
        <button type="button" className="text-link" disabled={pending} onClick={() => refresh()}>
          {pending ? "불러오는 중..." : "목록 다시 불러오기"}
        </button>
      </div>}
      <div className="mt-12">
        <p className="eyebrow mb-3 text-muted">COMMENTS · 최신순 · 한국 시간</p>
        {loaded && <CommentList comments={comments} />}
        {hasMore && <button type="button" className="text-link" disabled={pending} onClick={() => refresh(true)}>
          {pending ? "불러오는 중..." : "이전 의견 더 보기"}
        </button>}
      </div>
    </div>
  );
}
