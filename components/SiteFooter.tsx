import Link from "next/link";
import { Arrow } from "@/components/Arrow";

export function SiteFooter({ presentation = false }: { presentation?: boolean }) {
  return (
    <footer className="site-container flex flex-col gap-5 border-t border-line py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
      <p className="font-medium tracking-[0.04em]">203 PROJECT <span className="mx-2 text-line">/</span> A record of our progress.</p>
      {presentation ? (
        <Link href="/archive" className="inline-flex min-h-11 items-center gap-3 self-start text-ink hover:text-accent">
          모든 프레젠테이션 보기 <Arrow direction="up-right" />
        </Link>
      ) : (
        <p>한 분기씩, 차곡차곡.</p>
      )}
    </footer>
  );
}
