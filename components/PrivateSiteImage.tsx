import { hasSiteImage } from "@/lib/private-assets";
import type { SiteImageKey } from "@/lib/site-images-config";
import { requireAccessSession } from "@/lib/auth/session";
import { PrivateSitePhoto } from "./PrivateSitePhoto";

export async function PrivateSiteImage({ image, alt, className = "" }: { image: SiteImageKey; alt: string; className?: string }) {
  await requireAccessSession();
  // Authentication cookies must reach the Route Handler directly, never the optimizer.
  return <PrivateSitePhoto image={image} alt={alt} className={className} hasImage={await hasSiteImage(image)} />;
}
