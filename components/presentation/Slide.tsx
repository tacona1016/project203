import type { ReactNode } from "react";

type SlideProps = {
  id: string;
  number: string;
  label: string;
  tone?: "default" | "soft" | "accent";
  children: ReactNode;
};

const tones = {
  default: "bg-paper",
  soft: "bg-surface",
  accent: "slide-accent bg-accent text-white",
};

export function Slide({ id, number, label, tone = "default", children }: SlideProps) {
  return (
    <section id={id} aria-label={label} className={`presentation-slide ${tones[tone]}`}>
      <div className="site-container">
        <div className="slide-label"><span>{number}</span><span>{label}</span></div>
        {children}
      </div>
    </section>
  );
}
