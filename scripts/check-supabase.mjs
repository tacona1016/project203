import { createClient } from "@supabase/supabase-js";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !key) {
  console.error(".env.local의 NEXT_PUBLIC_SUPABASE_URL과 서버 전용 SUPABASE_SECRET_KEY를 설정하세요.");
  process.exit(1);
}
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }) },
});

let failed = false;
async function check(label, query) {
  const { data, error, status } = await query;
  if (error) {
    // Never print upstream messages, request headers, URLs or keys.
    console.error(`[${label}] 조회 실패 (HTTP ${status || 0}, ${error.code || "NETWORK_ERROR"})`);
    failed = true;
    return null;
  }
  console.log(`[${label}] 서버 조회 성공`);
  return data;
}
const [polls] = await Promise.all([
  check("polls", client.from("polls").select("id,poll_type,results_visibility,text_max_length,quarter").eq("slug", "land-priority")),
  check("participants", client.from("participants").select("id").eq("is_active", true).limit(1)),
  check("comments", client.from("comments").select("id,participant_id,participant:participants!comments_participant_id_fkey(display_name)").limit(1)),
  check("poll catalog RPC", client.rpc("get_poll_catalog", { p_include_hidden: false })),
]);
if (polls?.length) {
  await Promise.all([
    check("poll_options", client.from("poll_options").select("id").eq("poll_id", polls[0].id)),
    check("results RPC", client.rpc("get_poll_results", { p_poll_id: polls[0].id })),
    check("policy-aware detail RPC", client.rpc("get_poll_detail", { p_slug: "land-priority", p_admin: false })),
  ]);
} else {
  failed = true;
  console.error("land-priority 투표를 확인하지 못했습니다. 초기 환경이면 seed.sql을 확인하세요.");
}
if (failed) {
  console.error("서버 키·프로젝트 URL과 migration 적용 여부를 확인하세요.");
  process.exitCode = 1;
} else {
  console.log("서버 조회가 정상입니다. 등록·수정·삭제는 수행하지 않았습니다.");
  console.log("익명 차단은 supabase/tests/private_site_access.sql로 별도 확인하세요.");
}
