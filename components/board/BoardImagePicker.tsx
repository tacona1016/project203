"use client";
/* eslint-disable @next/next/no-img-element -- Local previews and authenticated image bytes bypass the optimizer. */
import type { BoardImage } from "@/lib/board/types";
import { BOARD_IMAGES, BOARD_IMAGE_TYPES, boardImageUrl } from "@/lib/board/image-policy";
export type PendingBoardImage = { id: string; file: File; preview: string; status: "waiting" | "uploading" | "failed"; error?: string };

export function BoardImagePicker({ images, queue, removed, allowed, onSelect, onRemove, onToggleRemove }: {
  images: BoardImage[] | null; queue: PendingBoardImage[]; removed: string[]; allowed: boolean;
  onSelect: (files: File[]) => void; onRemove: (id: string) => void; onToggleRemove: (id: string) => void;
}) {
  return <section className="board-image-picker" aria-labelledby="board-image-picker-title">
    <h2 id="board-image-picker-title" className="text-lg font-medium">사진 첨부</h2>
    <p className="form-note mt-3">최대 3장 · 한 장당 3MiB · JPG / PNG / WebP. 사진은 개별 업로드하고 위치정보 등 메타데이터를 제거합니다. 사진 파일은 임시저장에 포함되지 않습니다.</p>
    {!allowed ? <p className="form-note mt-4">사진은 게시글 작성자만 관리할 수 있습니다.</p> : images === null ? <p className="form-note mt-4">기존 사진을 불러오지 못했습니다. 새로고침 후 다시 확인해주세요. 본문은 수정할 수 있습니다.</p> : <>
      <label className="board-photo-add mt-5">사진 추가<input type="file" accept={BOARD_IMAGE_TYPES.join(",")} multiple disabled={images.length - removed.length + queue.length >= BOARD_IMAGES.maximum} onChange={event => { onSelect(Array.from(event.target.files ?? [])); event.target.value = ""; }} /></label>
      <div className="board-photo-previews">
        {images.map((image, index) => <div key={image.id} className={removed.includes(image.id) ? "is-removed" : ""}>
          <img src={boardImageUrl(image.post_id, image.id)} width={image.width} height={image.height} alt={`기존 사진 ${index + 1}`} />
          <p className="form-note">{removed.includes(image.id) ? "저장 시 삭제 예정" : "기존 사진"}</p>
          <button type="button" className="text-link" onClick={() => onToggleRemove(image.id)}>{removed.includes(image.id) ? "삭제 취소" : "사진 삭제"}</button>
        </div>)}
        {queue.map((image, index) => <div key={image.id}>
          <img src={image.preview} alt={`새 사진 ${index + 1} 미리보기`} />
          <p className="form-note" role="status">{image.status === "uploading" ? "업로드 중..." : image.status === "failed" ? image.error : "새 사진 · 저장 시 업로드"}</p>
          <button type="button" className="text-link" disabled={image.status === "uploading"} onClick={() => onRemove(image.id)}>사진 제거</button>
        </div>)}
      </div>
    </>}
  </section>;
}
