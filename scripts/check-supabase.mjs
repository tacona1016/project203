import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const pollId = process.argv[2] ?? "land-priority";
let validUrl = false;
try { validUrl = ["http:", "https:"].includes(new URL(url).protocol); } catch { /* 아래에서 안내합니다. */ }
if (!validUrl || !key) {
  console.error("[설정 오류] .env.local의 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 확인하세요.");
  process.exit(1);
}

let keyRole;
try { keyRole = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role; } catch { /* 공개 publishable 키는 JWT가 아닙니다. */ }
if (key.startsWith("sb_secret_") || keyRole === "service_role") {
  console.error("[설정 오류] 공개 anon 또는 publishable 키를 사용하세요. 비밀 키는 이 환경변수에 넣을 수 없습니다.");
  process.exit(1);
}

const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }) },
});

const [pollResult, commentsResult, participantsResult] = await Promise.all([
  client.from("polls").select("id,slug,quarter,allow_repeat_vote").eq("slug", pollId),
  client.from("comments").select("id,participant_id", { head: true }).limit(1),
  client.from("participants").select("id").eq("is_active", true),
]);
const results = [
  { table: "polls", ...pollResult },
  { table: "comments", ...commentsResult },
  { table: "participants", ...participantsResult },
];
const poll = pollResult.data?.[0];
if (poll) {
  const dependentChecks = [
    ["poll_options", client.from("poll_options").select("id").eq("poll_id", poll.id)],
    ["results RPC", client.rpc("get_poll_results", { p_poll_id: poll.id })],
  ];
  results.push(...await Promise.all(dependentChecks.map(async ([table, query]) => ({ table, ...await query }))));
}

let failed = false;
const actions = new Set();
for (const { table, data, error, status, count } of results) {
  if (error) {
    failed = true;
    const safeMessage = error.message.replaceAll(key, "[REDACTED]").replaceAll(url, "[PROJECT_URL]");
    console.error(`[${table}] HTTP ${status} / ${error.code || (status ? `HTTP_${status}` : "NETWORK_ERROR")}: ${safeMessage}`);
    if (["42703", "PGRST204"].includes(error.code)) {
      actions.add("최신 migrations/20261021_participants_and_vote_modes.sql 적용 여부를 확인하세요.");
    } else if (["PGRST205", "42P01"].includes(error.code)) {
      actions.add("참가자·투표 방식 migration과 seed_participants.sql을 적용하세요. 새 DB는 schema.sql부터 실행합니다.");
    } else if (error.code === "42501") {
      actions.add("최신 migration의 익명 권한·RLS·RPC EXECUTE 권한을 확인하세요.");
    } else if (error.code === "PGRST202") {
      actions.add("최신 migration으로 get_poll_results/submit_vote RPC를 생성하세요.");
    } else if (status === 401) {
      actions.add("Project URL과 공개 키가 같은 프로젝트의 값인지 확인하세요.");
    } else if (!status) {
      actions.add("프로젝트 상태, URL, 네트워크 연결을 확인하세요.");
    }
    continue;
  }
  if (["polls", "poll_options", "participants"].includes(table) && !data?.length) {
    failed = true;
    console.error(`[${table}] 공개 조회에서 ${pollId} 데이터를 찾지 못했습니다.`);
    actions.add("seed.sql/seed_participants.sql의 초기 데이터와 최신 migration의 SELECT 정책을 확인하세요.");
  } else {
    console.log(`[${table}] 조회 성공${Array.isArray(data) ? ` (${data.length}행)` : data?.total_votes !== undefined ? ` (${data.participant_count}명 · ${data.total_votes}표)` : count !== null ? ` (${count}표)` : ""}`);
  }
}

if (failed) {
  for (const action of actions) console.error(action);
  process.exitCode = 1;
} else {
  console.log("투표·선택지·결과·댓글의 공개 조회가 정상입니다. 등록·수정·삭제는 수행하지 않았습니다.");
}
