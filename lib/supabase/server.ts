import "server-only";
import { connection } from "next/server";
import { createPublicClient, getSupabaseConfig } from "./config";

export async function getSupabaseServerClient() {
  const config = getSupabaseConfig();
  if (!config) return null;

  // 빌드 중 DB 요청을 하지 않고, 방문할 때 최신 데이터를 조회합니다.
  await connection();
  return createPublicClient(config);
}
