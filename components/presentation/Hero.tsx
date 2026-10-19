import type { Quarter } from "@/data/quarters";
import { Arrow } from "@/components/Arrow";
import { QuarterCover } from "@/components/QuarterCover";

type HeroProps = {
  quarter: Quarter;
  title: string;
  description: string;
};

export function Hero({ quarter, title, description }: HeroProps) {
  return (
    <section id="cover" aria-labelledby="cover-title" className="presentation-hero site-container">
      <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div>
          <p className="eyebrow mb-8 text-accent">{quarter.year} Q{quarter.quarter} <span className="mx-2">·</span> {quarter.title}</p>
          <h1 id="cover-title" className="hero-title max-w-2xl">{title}</h1>
          <p className="mt-7 max-w-md text-base leading-8 text-muted sm:text-lg">{description}</p>
          <a href="#summary" className="text-link mt-10">이번 분기 살펴보기 <Arrow direction="down" /></a>
        </div>
        <QuarterCover year={quarter.year} quarter={quarter.quarter} />
      </div>
      <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-xs text-muted lg:mt-16">
        <span>QUARTERLY PRESENTATION</span>
        <span>아래로 스크롤하며 읽어주세요 <span aria-hidden="true" className="ml-2">↓</span></span>
      </div>
    </section>
  );
}
