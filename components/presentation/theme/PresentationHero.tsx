import type { ReactNode } from "react";
export function PresentationHero({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return <div className="presentation-hero-content"><p className="presentation-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="presentation-lead">{description}</p>{children}</div>;
}
