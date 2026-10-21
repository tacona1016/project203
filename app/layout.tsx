import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ParticipantProvider } from "@/components/interactive/ParticipantProvider";

export const metadata: Metadata = {
  title: { default: "203 PROJECT", template: "%s | 203 PROJECT" },
  description: "203 PROJECT의 분기별 웹 프레젠테이션. 이번 분기의 기록과 다음을 위한 방향을 살펴봅니다.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <ParticipantProvider>
          <a href="#main-content" className="skip-link">본문으로 건너뛰기</a>
          {children}
        </ParticipantProvider>
      </body>
    </html>
  );
}
