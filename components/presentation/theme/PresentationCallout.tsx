import type { ReactNode } from "react";
export function PresentationCallout({ label, children, tone = "insight" }: { label: string; children: ReactNode; tone?: "fact" | "insight" | "warning" }) {
  return <aside className={`presentation-callout is-${tone}`}><strong>{label}</strong><div>{children}</div></aside>;
}
export function PresentationSummary({ items }: { items: { title: string; detail: string }[] }) {
  return <ol className="presentation-summary">{items.map((item, index) => <li key={item.title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{item.title}</h3><p>{item.detail}</p></div></li>)}</ol>;
}
export function PresentationSource({ time, href, children }: { time: string; href?: string; children?: ReactNode }) {
  return <footer className="presentation-source"><span>집계 기준 {time} · 원천: Supabase 운영 DB 읽기 전용 스냅샷</span>{href && <a href={href}>원본 투표 →</a>}{children}</footer>;
}
