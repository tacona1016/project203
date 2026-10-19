import type { ReactNode } from "react";

export function TwoColumn({ children }: { children: ReactNode }) {
  return (
    <div className="two-column grid min-w-0 grid-cols-1 gap-8 md:grid-cols-2 md:gap-12 lg:gap-16">
      {children}
    </div>
  );
}
