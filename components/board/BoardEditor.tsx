"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useBoard } from "./BoardProvider";
import { BOARD_LIMITS, boardInput, boardTextLength, canManageBoardPost } from "@/lib/board/validation";
import { DECISION_RECORD_TEMPLATE } from "@/lib/board/decision-template";
import { boardRequest } from "@/lib/board/client";
import type { BoardImage, BoardPost } from "@/lib/board/types";
import { BoardDraftTools } from "./BoardDraftTools";
import { boardDraftKey } from "@/lib/board/draft";
import { boardPostHref, boardReturnTo } from "@/lib/board/view";
import { BoardImagePicker, type PendingBoardImage } from "./BoardImagePicker";
import { BOARD_IMAGES, BOARD_IMAGE_TYPES } from "@/lib/board/image-policy";
import { sendBoardImage } from "@/lib/board/image-client";

export function BoardEditor({ initial, notice = false, returnTo = "/board" }: { initial?: BoardPost; notice?: boolean; returnTo?: string }) {
  const { viewer, loading } = useBoard();
  const [title, setTitle] = useState(initial?.title ?? ""), [content, setContent] = useState(initial?.content ?? "");
  const [type, setType] = useState(initial?.post_type ?? (notice ? "notice" : "general")), [pinned, setPinned] = useState(initial?.is_pinned ?? false);
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  const router = useRouter();
  const submitting = useRef(false);
  const committed = useRef(false);
  const [savedId, setSavedId] = useState<string | number | null>(null);
  const [images, setImages] = useState<BoardImage[] | null>(initial ? initial.images ?? null : []);
  const [queue, setQueue] = useState<PendingBoardImage[]>([]), [removed, setRemoved] = useState<string[]>([]);
  const previews = useRef(new Set<string>());
  const photoDirty = queue.length > 0 || removed.length > 0;
  const canManagePhotos = !initial || initial.author_id === viewer.participantId && (initial.post_type === "general" || viewer.isAdmin);
  useEffect(() => { const urls = previews.current; return () => { for (const url of urls) URL.revokeObjectURL(url); }; }, []);
  const allowed = !loading && (viewer.isAdmin || viewer.verified) && (!initial || canManageBoardPost(initial, viewer));
  const titleLength = boardTextLength(title), contentLength = boardTextLength(content);
  const titleTooLong = titleLength > BOARD_LIMITS.title, contentTooLong = contentLength > BOARD_LIMITS.content;
  const dirty = title !== (initial?.title ?? "") || content !== (initial?.content ?? "") || type !== (initial?.post_type ?? (notice ? "notice" : "general")) || pinned !== (initial?.is_pinned ?? false);
  const listHref = boardReturnTo(returnTo);
  useEffect(() => {
    if (!dirty && !photoDirty) return;
    const warn = (event: BeforeUnloadEvent) => { if (!committed.current || photoDirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, photoDirty]);
  function selectImages(files: File[]) {
    if (!canManagePhotos || !images) return;
    if (images.length - removed.length + queue.length + files.length > BOARD_IMAGES.maximum) { setError("사진은 최대 3장까지 첨부할 수 있습니다."); return; }
    if (files.some(file => !file.size || file.size > BOARD_IMAGES.bytes || !BOARD_IMAGE_TYPES.some(type => type === file.type))) { setError("JPG·PNG·WebP 사진을 한 장당 3MiB 이하로 선택해주세요."); return; }
    setError(""); setQueue(current => [...current, ...files.map(file => { const preview = URL.createObjectURL(file); previews.current.add(preview); return { id: crypto.randomUUID(), file, preview, status: "waiting" as const }; })]);
  }
  function removeQueued(id: string) { setQueue(current => current.filter(item => { if (item.id !== id) return true; URL.revokeObjectURL(item.preview); previews.current.delete(item.preview); return false; })); }
  function applyDecisionTemplate() {
    if (content.trim() && !window.confirm("작성 중인 본문을 결정 기록 양식으로 바꿀까요?")) return;
    setContent(DECISION_RECORD_TEMPLATE);
    if (!title.trim()) setTitle("[결정] 결정 제목");
    setError("");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!allowed || pending || submitting.current) return;
    let input;
    try { input = boardInput({ title, content, post_type: viewer.isAdmin ? type : "general", is_pinned: viewer.isAdmin && type === "notice" && pinned }); }
    catch (error) { setError((error as Error).message); return; }
    submitting.current = true; setPending(true); setError("");
    try {
      const result = savedId ? { id: savedId } : await boardRequest<{ id: string | number }>(initial ? `/api/board/posts/${initial.id}` : "/api/board/posts", initial ? "PATCH" : "POST", input);
      committed.current = true;
      setSavedId(result.id);
      try { localStorage.removeItem(boardDraftKey(viewer.participantId!, `${initial ? `edit-${initial.id}` : "new"}:${type}`)); } catch { /* Saving succeeded; a blocked browser store cannot undo it. */ }
      for (const imageId of removed) {
        await boardRequest(`/api/board/posts/${result.id}/images/${imageId}`, "DELETE");
        setRemoved(current => current.filter(id => id !== imageId)); setImages(current => current?.filter(image => image.id !== imageId) ?? null);
      }
      let failed = false;
      for (const item of queue) {
        setQueue(current => current.map(image => image.id === item.id ? { ...image, status: "uploading", error: undefined } : image));
        try {
          const saved = await sendBoardImage(result.id, item.id, item.file);
          setImages(current => [...(current ?? []), saved]); removeQueued(item.id);
        } catch (failure) {
          failed = true; setQueue(current => current.map(image => image.id === item.id ? { ...image, status: "failed", error: failure instanceof Error ? failure.message : "사진 업로드에 실패했습니다." } : image));
        }
      }
      if (failed) { setError("게시글 본문은 저장되었습니다. 실패한 사진만 다시 처리하거나 게시글을 확인해주세요."); submitting.current = false; setPending(false); return; }
      router.push(`${boardPostHref(result.id, listHref)}&saved=1`); router.refresh();
    } catch (error) { setError((error as Error).message); submitting.current = false; setPending(false); }
  }
  return <form className="board-editor" onSubmit={submit} aria-busy={pending}>
    <fieldset disabled={!allowed || pending}>
      <legend className="sr-only">게시글 내용</legend>
      {allowed && !savedId && viewer.participantId && <BoardDraftTools key={`${viewer.participantId}:${initial?.id ?? "new"}:${type}`} owner={viewer.participantId} scope={`${initial ? `edit-${initial.id}` : "new"}:${type}`} committed={committed} value={{ title, content, post_type: type, is_pinned: pinned }} onRestore={draft => { setTitle(draft.title); setContent(draft.content); setType(draft.post_type); setPinned(draft.is_pinned); }} />}
      {viewer.isAdmin && <div className="board-editor-settings"><label htmlFor="board-post-type">게시글 유형</label>
        <select id="board-post-type" disabled={!!savedId} value={type} onChange={(event) => { setType(event.target.value as "general" | "notice"); if (event.target.value !== "notice") setPinned(false); }}>
          <option value="general">일반 게시글</option><option value="notice">공지사항</option>
        </select>
        {type === "notice" && <label className="board-check"><input type="checkbox" disabled={!!savedId} checked={pinned} onChange={(event) => setPinned(event.target.checked)} />게시판 상단에 고정</label>}
      </div>}
      {viewer.isAdmin && type === "notice" && !initial && <div className="interaction-notice mb-6">
        <button type="button" className="text-link" disabled={!!savedId} onClick={applyDecisionTemplate}>결정 기록 양식 넣기</button>
        <p className="form-note mt-3">투표 결과와 최종 합의는 다를 수 있습니다. 실제로 합의된 내용만 작성하고 확인 후 등록해주세요.</p>
      </div>}
      <label htmlFor="board-title">제목</label><input id="board-title" disabled={!!savedId} value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="이야기의 제목" aria-describedby="board-title-count" aria-invalid={titleTooLong} />
      <p id="board-title-count" className={`form-note mt-3 tabular-nums ${titleTooLong ? "text-red-700" : ""}`}>{titleLength} / {BOARD_LIMITS.title}자{titleTooLong && " · 제목을 줄여주세요."}</p>
      <label htmlFor="board-content">본문</label><textarea id="board-content" disabled={!!savedId} value={content} onChange={(event) => setContent(event.target.value)} rows={14} required placeholder="함께 나누고 싶은 이야기를 적어주세요." aria-describedby="board-content-count board-text-policy" aria-invalid={contentTooLong} />
      <p id="board-content-count" className={`form-note mt-3 tabular-nums ${contentTooLong ? "text-red-700" : ""}`}>{contentLength} / {BOARD_LIMITS.content}자{contentTooLong && " · 본문을 줄여주세요."}</p>
      <p id="board-text-policy" className="form-note mt-2">저장 기준으로 앞뒤 공백을 제외하고 줄바꿈을 포함합니다. 이모지 조합은 여러 글자로 셀 수 있습니다.</p>
      <p className="form-note mt-2">웹 주소는 https://로 시작해 붙여 넣으면 본문에서 링크로 표시됩니다. HTML이나 Markdown은 일반 글자로 표시합니다.</p>
      <BoardImagePicker images={images} queue={queue} removed={removed} allowed={canManagePhotos} onSelect={selectImages} onRemove={removeQueued} onToggleRemove={id => setRemoved(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])} />
      {savedId && <p className="form-feedback mt-5" role="status">제목·본문은 저장되었습니다. 사진을 다시 처리해도 게시글이 중복 생성되지 않습니다. <Link className="text-link" href={boardPostHref(savedId, listHref)}>저장된 게시글 확인 →</Link></p>}
      <div className="mt-8 flex flex-wrap gap-6 items-center"><button type="submit" className="interaction-button" disabled={titleTooLong || contentTooLong || !titleLength || !contentLength}>{pending ? "저장 중..." : savedId ? "사진 다시 처리" : initial ? "수정 저장" : "게시글 등록"}</button><Link className="text-link" href={initial ? boardPostHref(initial.id, listHref) : listHref} onClick={event => { if ((dirty && !committed.current || photoDirty) && !window.confirm("작성 중인 내용을 닫을까요? 기기 임시저장을 켜지 않았다면 내용이 사라집니다. 사진 파일은 임시저장되지 않습니다.")) event.preventDefault(); }}>취소</Link></div>
    </fieldset>
    {!loading && !allowed && <p className="form-note mt-5">이 게시글을 작성하거나 수정할 권한이 없습니다.</p>}
    {error && <p className="form-error mt-5" role="alert">{error}</p>}
  </form>;
}
