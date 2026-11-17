"use client";
/* eslint-disable @next/next/no-img-element -- Authenticated bytes bypass public image optimization. */
import { useEffect, useRef, useState } from "react";
import { pollImageUrl, type PollImage } from "@/lib/poll-images/model";

export function PollImageGallery({ slug, images, label = "질문 사진" }: { slug: string; images: PollImage[]; label?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), opener = useRef<HTMLButtonElement | null>(null);
  const open = active !== null;
  useEffect(() => {
    const node = dialog.current;
    if (!open || !node) return;
    node.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { node.close(); document.body.style.overflow = overflow; opener.current?.focus(); };
  }, [open]); // Switching photos keeps the modal/focus scope open.
  if (!images.length) return null;
  const image = active === null ? null : images[active];
  return <div className="poll-image-gallery" aria-label={label}>
    <div className="poll-image-grid" data-count={images.length}>{images.map((item, index) => <button type="button" key={item.id} className="poll-image-open" aria-label={`${label} ${index + 1} 확대`} onClick={event => { event.stopPropagation(); opener.current = event.currentTarget; setActive(index); }}>
      <img src={pollImageUrl(slug, item.id)} width={item.width} height={item.height} alt={`${label} ${index + 1}`} loading="lazy" />
      <span>확대</span>
    </button>)}</div>
    <dialog ref={dialog} className="board-image-dialog poll-image-dialog" aria-label={`${label} 확대 보기`} onCancel={() => setActive(null)} onClose={() => setActive(null)} onClick={event => { if (event.target === event.currentTarget) setActive(null); }}>
      <div><div className="poll-image-dialog-actions"><button type="button" className="text-link" autoFocus onClick={() => setActive(null)}>사진 닫기</button>
        {images.length > 1 && <><button type="button" className="text-link" disabled={active === 0} onClick={() => setActive(value => Math.max(0, (value ?? 0) - 1))}>이전 사진</button><button type="button" className="text-link" disabled={active === images.length - 1} onClick={() => setActive(value => Math.min(images.length - 1, (value ?? 0) + 1))}>다음 사진</button></>}
      </div>{image && <img src={pollImageUrl(slug, image.id)} width={image.width} height={image.height} alt={`${label} ${(active ?? 0) + 1} 확대`} />}</div>
    </dialog>
  </div>;
}
