import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { ACCESS_COOKIE, getAccessSession } from "./session";
import { SESSION_DURATION } from "./token";
import { HttpError } from "./http";

const cookieName = "project203_participant_selection";
const options = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };

function signature(id: string, accessToken: string) {
  return createHmac("sha256", process.env.SITE_SESSION_SECRET ?? "")
    .update(`203-project:participant-selection:v1\0${accessToken}\0${id}`).digest();
}

// Records a freely chosen identity, not proof of a person's real identity.
// Binding it to the access token prevents changing a URL ID from reading another response.
export async function setParticipantSelection(id: string) {
  if (!await getAccessSession()) throw new HttpError(401, "사이트 비밀번호 인증이 필요합니다.");
  const jar = await cookies();
  const accessToken = jar.get(ACCESS_COOKIE)!.value;
  jar.set(cookieName, `${id}.${signature(id, accessToken).toString("base64url")}`, { ...options, maxAge: SESSION_DURATION });
}

export async function requireParticipantSelection(expectedId: string) {
  if (!await getAccessSession()) throw new HttpError(401, "사이트 비밀번호 인증이 필요합니다.");
  const jar = await cookies();
  const [id, signed, extra] = (jar.get(cookieName)?.value ?? "").split(".");
  if (id !== expectedId || extra || !signed || !/^[A-Za-z0-9_-]{43}$/.test(signed)) throw new HttpError(403, "현재 선택한 이름으로 다시 시도해주세요.");
  const actual = Buffer.from(signed, "base64url");
  const expected = signature(id, jar.get(ACCESS_COOKIE)!.value);
  if (actual.toString("base64url") !== signed || actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new HttpError(403, "이름을 다시 선택해주세요.");
}

export async function getSelectedParticipantId(): Promise<string | null> {
  const id = ((await cookies()).get(cookieName)?.value ?? "").split(".")[0];
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  try { await requireParticipantSelection(id); return id; } catch { return null; }
}

export async function clearParticipantSelection() {
  (await cookies()).set(cookieName, "", { ...options, maxAge: 0 });
}
