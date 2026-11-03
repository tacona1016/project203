"use client";
/* eslint-disable @next/next/no-img-element -- Member-only bytes must bypass the public optimizer. */
import { useEffect, useRef, useState } from "react";
import type { BoardImage } from "@/lib/board/types";
import { boardImageUrl } from "@/lib/board/image-policy";

export function BoardImageGallery({ images }: { images?: BoardImage[] | null }) {
  const [active, setActive] = useState<BoardImage | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), opener = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const node = dialog.current;
    if (active && node && !node.open) node.showModal();
    if (!active && node?.open) node.close();
  }, [active]);
  if (!images?.length) return null;
  return <section className="board-gallery" aria-label="첨부 사진">
    <div className="board-gallery-grid">{images.map((image, index) => <button type="button" key={image.id} onClick={event => { opener.current = event.currentTarget; setActive(image); }} aria-label={`첨부 사진 ${index + 1} 크게 보기`}>
      <img src={boardImageUrl(image.post_id, image.id)} width={image.width} height={image.height} alt={`첨부 사진 ${index + 1}`} loading="lazy" />
    </button>)}</div>
    <dialog ref={dialog} className="board-image-dialog" onClose={() => { setActive(null); opener.current?.focus(); }} onCancel={() => setActive(null)} onClick={event => { if (event.target === event.currentTarget) setActive(null); }}>
      <div><button type="button" className="text-link" onClick={() => setActive(null)} autoFocus>사진 닫기</button>
        {active && <img src={boardImageUrl(active.post_id, active.id)} width={active.width} height={active.height} alt="첨부 사진 확대" />}
      </div>
    </dialog>
  </section>;
}
