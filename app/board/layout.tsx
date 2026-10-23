import type { ReactNode } from "react";
import { requireAccessSession } from "@/lib/auth/session";
import { BoardProvider } from "@/components/board/BoardProvider";

export default async function BoardLayout({ children }: { children: ReactNode }) {
  await requireAccessSession("/board");
  return <BoardProvider>{children}</BoardProvider>;
}
