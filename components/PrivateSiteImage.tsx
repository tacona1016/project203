import Image from "next/image";
import { readSiteImage } from "@/lib/private-assets";
import type { SiteImageKey } from "@/lib/site-images-config";
import { requireAccessSession } from "@/lib/auth/session";

export async function PrivateSiteImage({ image, alt, className = "" }: { image: SiteImageKey; alt: string; className?: string }) {
  await requireAccessSession();
  if (!await readSiteImage(image)) return null;
  // Authentication cookies must reach the Route Handler directly, never the optimizer.
  return <div className={`private-site-photo ${className}`}><Image src={`/api/site-images/${image}`} alt={alt} fill sizes="100vw" unoptimized /></div>;
}
