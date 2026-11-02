"use client";

import Image from "next/image";
import { useState } from "react";
import type { SiteImageKey } from "@/lib/site-images-config";

export function PrivateSitePhoto({ image, alt, className, hasImage }: { image: SiteImageKey; alt: string; className: string; hasImage: boolean }) {
  const [failed, setFailed] = useState(false);
  const showImage = hasImage && !failed;
  return <div className={`private-site-photo ${className}`} data-image-state={showImage ? "image" : "fallback"}>
    {showImage ? <Image src={`/api/site-images/${image}`} alt={alt} fill sizes="100vw" unoptimized onError={() => setFailed(true)} /> :
      <div className="private-site-fallback" role="img" aria-label="203 PROJECT의 기본 배경"><span aria-hidden="true">203 PROJECT</span></div>}
  </div>;
}
