"use client";
/* eslint-disable @next/next/no-img-element -- Browser-only Object URLs never enter public optimization. */
import { useState } from "react";
import type { DraftImage } from "@/lib/poll-images/create-flow";
import { validatePollImageFile } from "@/lib/poll-images/client";

export function PollDraftImages({ images, maximum, label, onSelect, onRemove, onMove }: {
  images: DraftImage[]; maximum: number; label: string;
  onSelect: (files: File[]) => void; onRemove: (id: string) => void; onMove?: (id: string, direction: number) => void;
}) {
  const [error, setError] = useState("");
  return <div className="poll-draft-images" aria-label={label}>
    <p className="text-sm font-medium">{label} · {images.length}/{maximum}</p>
    <label className="poll-image-file">{maximum === 1 && images.length ? "선택지 사진 변경" : `${label} 추가`}
      <input type="file" accept="image/jpeg,image/png,image/webp" aria-label={`${label} 파일 선택`} multiple={maximum > 1} disabled={maximum > 1 && images.length >= maximum} onChange={event => {
        const files = Array.from(event.target.files ?? []); event.target.value = ""; setError("");
        try {
          if (files.length > (maximum === 1 ? 1 : maximum - images.length)) throw new Error(`사진은 최대 ${maximum}장입니다.`);
          files.forEach(validatePollImageFile); if (files.length) onSelect(files);
        } catch (error) { setError(error instanceof Error ? error.message : "사진을 확인해주세요."); }
      }} />
    </label>
    <div className="poll-image-admin-grid">{images.map((image, index) => <div key={image.clientId} className="poll-image-admin-item" data-draft-image-id={image.clientId}>
      <img className="poll-draft-preview" src={image.previewUrl} alt={`${label} ${index + 1} 미리보기`} />
      <p className="form-note break-all">{image.file.name} · 원본 {Math.ceil(image.file.size / 1000)}KB</p>
      <div className="poll-image-actions"><button type="button" className="text-link" onClick={() => onRemove(image.clientId)}>{label} {index + 1} 제거</button>
        {onMove && <><button type="button" className="text-link" disabled={index === 0} onClick={() => onMove(image.clientId, -1)}>앞으로</button><button type="button" className="text-link" disabled={index === images.length - 1} onClick={() => onMove(image.clientId, 1)}>뒤로</button></>}
      </div></div>)}</div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
