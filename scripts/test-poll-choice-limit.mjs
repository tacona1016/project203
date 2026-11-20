// Independent TEST PostgreSQL only. No production URL, production fixtures or
// automatic migration application. Requires psql; never prints connection data.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const raw = process.env.PROJECT203_TEST_DATABASE_URL;
if (!raw || process.env.PROJECT203_TEST_DATABASE !== "isolated") {
  console.error("미실행: 독립 TEST DB URL과 PROJECT203_TEST_DATABASE=isolated 확인이 필요합니다. 운영 DB 사용 금지.");
  process.exit(2);
}
let target;
try { target = new URL(raw); } catch { console.error("TEST DB URL 형식을 확인해주세요."); process.exit(2); }
if (!["postgres:", "postgresql:"].includes(target.protocol) || raw.includes("xpyyyqqfnlmgxxlenxua") || raw.includes("cpmfuxbrkiqywpojvivi")) {
  console.error("운영 또는 관련 없는 프로젝트 연결은 거부합니다."); process.exit(2);
}
const env = { ...process.env, PGHOST: target.hostname, PGPORT: target.port || "5432", PGUSER: decodeURIComponent(target.username), PGPASSWORD: decodeURIComponent(target.password), PGDATABASE: decodeURIComponent(target.pathname.slice(1)), PGCONNECT_TIMEOUT: "10", PGOPTIONS: "-c project203.test_database=on", PGSSLMODE: ["localhost", "127.0.0.1", "::1"].includes(target.hostname) ? "prefer" : "require" };
delete env.PROJECT203_TEST_DATABASE_URL;
function query(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn("psql", ["--no-psqlrc", "--no-align", "--tuples-only", "--set", "ON_ERROR_STOP=1"], { env, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", data => { output += data; });
    child.stderr.resume(); // SQL errors can include row contents; never print them.
    child.once("error", () => reject(Error("psql 실행 불가: TEST PostgreSQL 검증 미실행")));
    child.once("exit", code => code === 0 ? resolve(output.trim()) : reject(Error("TEST SQL 검증 실패 (민감정보 보호를 위해 원문 로그 생략)")));
    child.stdin.end("set statement_timeout='20s';set lock_timeout='10s';\n" + sql);
  });
}
const actor = randomUUID(), title = "QA-choice-limit-" + randomUUID();
let poll, setupStarted = false;
try {
  const marker = await query("select exists(select 1 from pg_attribute where attrelid='public.polls'::regclass and attname='max_choices_per_participant' and not attisdropped);");
  assert(marker.endsWith("t"), "Apply the proposal to this independent TEST DB first");
  assert((await query(readFileSync("supabase/tests/poll_multiple_selection_limit.sql", "utf8"))).includes("t"));
  console.log("TEST PostgreSQL: 설정·RPC·직접쓰기·rollback·기존행 보존 SQL 통과");
  setupStarted = true;
  const setup = await query(`begin;
    insert into public.participants(id,display_name,is_active) values('${actor}','${title}',true);
    select public.admin_create_poll(jsonb_build_object('quarter','2026-q4','title','${title}','description','','poll_type','choice','vote_mode','multiple',
      'text_max_length',1000,'results_visibility','after_close','allow_vote_change',true,'is_hidden',false,
      'voting_starts_at',null,'voting_ends_at',null,'max_choices_per_participant',2,'options','["A","B","C","D"]'::jsonb));commit;
    select jsonb_build_object('id',p.id,'options',(select jsonb_agg(o.id order by display_order,id) from public.poll_options o where poll_id=p.id)) from public.polls p where title='${title}';`);
  poll = JSON.parse(setup.split("\n").findLast(line => line.startsWith('{"id"')));
  const [a, b, c, d] = poll.options;
  const ballot = ids => `select public.submit_choice_ballot(${poll.id},array[${ids}], '${actor}');`;
  await query(ballot([a,b]));
  // Actual independent connections: one holds the parent lock, the other waits.
  const first = query(`begin;select 1 from public.polls where id=${poll.id} for update;select pg_sleep(0.5);${ballot([a,c])}commit;`);
  const second = query(`begin;${ballot([b,d])}commit;`);
  await Promise.all([first, second]);
  const final = await query(`select public.get_poll_participation(${poll.id},'${actor}');`);
  const ids = JSON.parse(final.split("\n").findLast(line => line.startsWith("{"))).option_ids;
  assert([JSON.stringify([a,c]),JSON.stringify([b,d])].includes(JSON.stringify(ids)), "Concurrent replacement must be exactly one complete set");
  // Two direct inserts racing for the last slot: precisely one may commit.
  await query(ballot([a]));
  const direct = id => query(`begin;insert into public.poll_choice_selections(poll_id,participant_id,option_id,is_selected) values(${poll.id},'${actor}',${id},true) on conflict(poll_id,participant_id,option_id) do update set is_selected=true;select pg_sleep(0.2);commit;`);
  const attempts = await Promise.allSettled([direct(b),direct(c)]);
  assert.equal(attempts.filter(attempt => attempt.status === "fulfilled").length, 1, "Direct concurrent over-count must fail");
  assert((await query(`select count(*) from public.poll_choice_selections where poll_id=${poll.id} and participant_id='${actor}' and is_selected;`)).endsWith("2"));
  // REPEATABLE READ cannot bypass final-count safety using a stale snapshot.
  assert.equal((await Promise.allSettled([query(`begin isolation level repeatable read;${ballot([a,b])}commit;`) ]))[0].status, "rejected");
  console.log("TEST PostgreSQL: 실제 2개 연결 동시 교체·직접 삽입 제한·isolation 방어 통과");
} finally {
  // Only random IDs created by this run; independent TEST only. No production.
  if (setupStarted) await query(`begin;delete from public.poll_choice_selections s using public.polls p where s.poll_id=p.id and p.title='${title}' and s.participant_id='${actor}';delete from public.polls where title='${title}';delete from public.participants where id='${actor}' and display_name='${title}';commit;`);
}
