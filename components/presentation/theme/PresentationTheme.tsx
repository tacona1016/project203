import type { ReactNode } from "react";
import { PresentationNavigator } from "../PresentationNavigator";
import { requireAccessSession } from "@/lib/auth/session";
import "./presentation-theme.css";

/** Keep the theme private even if a future route omits its own session guard. */
export async function PresentationTheme({ children, title = "203 DeviceBook Presentation", review = true, header, footer }: { children: ReactNode; title?: string; review?: boolean; header?: ReactNode; footer?: ReactNode }) {
  await requireAccessSession();
  return <div className="presentation-theme" data-published={!review || undefined}>
    {header ?? <header className="presentation-book-header"><a href="#main-content">203 PROJECT <span>· {title}</span></a>{review && <span className="presentation-review-label">검토용 시안 · 운영 미반영</span>}</header>}
    <PresentationNavigator book />
    <main id="main-content" tabIndex={-1} className="presentation">{children}</main>
    {footer ? <div className="presentation-published-footer">{footer}</div> : <footer className="presentation-book-footer">203 DeviceBook Presentation · {review && "검토 후 최종 반영 · "}Design principles inspired by DeviceBook</footer>}
  </div>;
}
