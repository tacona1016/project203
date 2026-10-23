import "server-only";
import { cookies } from "next/headers";
import { ACCESS_COOKIE, getAccessSession } from "./session";
import { getSelectedParticipantId } from "./participant-session";
import { getAdminSession } from "./admin-session";
import { HttpError } from "./http";
import { configuredBoardPassword, boardSigningKey, boardPasswordIssue } from "./board-token";
import { SESSION_DURATION, signSession, verifySession } from "./token";
import { protectedClient } from "@/lib/site-data";
import { getActiveParticipant } from "@/lib/supabase/queries";
import type { BoardViewer } from "@/lib/board/types";

export const BOARD_COOKIE = "project203_board";
const options = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };

export async function getBoardViewer(): Promise<BoardViewer> {
  const client = await protectedClient();
  const selectedId = await getSelectedParticipantId();
  const participant = selectedId ? await getActiveParticipant(client, selectedId) : null;
  const isAdmin = !!await getAdminSession();
  const jar = await cookies();
  const password = participant ? configuredBoardPassword(process.env.BOARD_PARTICIPANT_PASSWORDS, participant.id) : null;
  const verified = !!participant && !!password && !!verifySession(jar.get(BOARD_COOKIE)?.value, boardSigningKey(process.env.SITE_SESSION_SECRET ?? "", participant.id, password, jar.get(ACCESS_COOKIE)?.value ?? ""));
  return { participantId: participant?.id ?? null, isAdmin, verified, configured: !!password,
    configurationIssue: participant ? boardPasswordIssue(process.env.BOARD_PARTICIPANT_PASSWORDS, participant.id) : null };
}

export async function requireBoardActor() {
  const viewer = await getBoardViewer();
  if (!viewer.participantId) throw new HttpError(403, "먼저 이름을 선택해주세요.");
  if (!viewer.isAdmin && !viewer.verified) throw new HttpError(403, "게시판 개인 비밀번호를 먼저 확인해주세요.");
  return { participantId: viewer.participantId, isAdmin: viewer.isAdmin };
}

export async function createBoardSession(participantId: string, password: string) {
  if (!await getAccessSession() || await getSelectedParticipantId() !== participantId) throw new HttpError(403, "이름을 다시 선택해주세요.");
  const jar = await cookies();
  const { token, expiresAt } = signSession(boardSigningKey(process.env.SITE_SESSION_SECRET ?? "", participantId, password, jar.get(ACCESS_COOKIE)!.value));
  jar.set(BOARD_COOKIE, token, { ...options, maxAge: SESSION_DURATION, expires: new Date(expiresAt * 1000) });
}
export async function clearBoardSession() { (await cookies()).set(BOARD_COOKIE, "", { ...options, maxAge: 0 }); }
