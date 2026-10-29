import "server-only";
import { getAdminSession } from "./admin-session";
import { requireApiSession } from "./http";
import type { BoardViewer } from "@/lib/board/types";

export async function getBoardViewer(): Promise<BoardViewer> {
  const member = await requireApiSession();
  return { participantId: member.participantId, isAdmin: !!await getAdminSession(), verified: true };
}
export async function requireBoardActor() {
  const viewer = await getBoardViewer();
  return { participantId: viewer.participantId!, isAdmin: viewer.isAdmin };
}
