// Generate a session-only PostgreSQL test without touching application rows or
// their sequences. Pass the output to the authorized SQL client; always rollback.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const metadataFile = process.argv[2];
if (!metadataFile) throw new Error("Read-only pg_get_functiondef metadata file required");
const metadata = JSON.parse(readFileSync(metadataFile, "utf8"));
// Optionally compare a separately captured pre-release snapshot. No ignored
// workstation-specific file is required to use this generator in a fresh clone.
if (process.argv[3]) {
  const baseline = JSON.parse(readFileSync(process.argv[3], "utf8"));
  for (const name of Object.keys(baseline)) assert.equal(metadata.functions[name], baseline[name], `Production RPC drift: ${name}`);
}
const tables = ["participants", "polls", "poll_options", "votes", "poll_choice_selections"];
let setup = "begin;\nset local statement_timeout='20s';\nset local project203.test_database='on';\n";
for (const table of tables) setup += `create temp table ${table} (like public.${table} including all);\n`;
// Permit verification after rollout as well: this affects only the empty temp
// copy. It never removes the production column or its saved configuration.
setup += "alter table pg_temp.polls drop column if exists max_choices_per_participant;\n";
for (const table of ["polls", "poll_options", "votes"]) {
  // INCLUDING IDENTITY allocates a new temp sequence. For serial definitions,
  // rebind defaults BEFORE any insert so no public sequence can be advanced.
  setup += `do $$ begin if (select attidentity='' from pg_attribute where attrelid='pg_temp.${table}'::regclass and attname='id') then
    create temp sequence qa_${table}_id;
    alter table pg_temp.${table} alter column id set default nextval('pg_temp.qa_${table}_id'::regclass);
    alter sequence pg_temp.qa_${table}_id owned by pg_temp.${table}.id;
  end if;
  assert (select relnamespace=pg_my_temp_schema() from pg_class where oid=pg_get_serial_sequence('pg_temp.${table}','id')::regclass),'Sequence must be temporary';
  end $$;\n`;
}
for (const constraint of metadata.constraints.filter(item => item.def.startsWith("FOREIGN KEY"))) setup += `alter table pg_temp.${constraint.table} add constraint ${constraint.name} ${constraint.def.replace(/REFERENCES (\w+)\(/g, "REFERENCES pg_temp.$1(")};\n`;
// Existing catalog/participation/results and settings guards run only on the
// temporary copies. No production result or write RPC is invoked by the tests.
const dependencies = ["sync_poll_settings", "guard_poll_quarter", "guard_poll_content", "guard_poll_vote", "get_poll_legacy_results", "get_poll_results", "get_poll_participation", "get_poll_catalog"];
const definitions = dependencies.map(name => metadata.functions[name].trim() + ";").join("\n");
const triggers = metadata.triggers.filter(def => !def.includes("guard_poll_choice_selection()")).map(def => def.replace(/EXECUTE FUNCTION (\w+)\(/, "EXECUTE FUNCTION public.$1(") + ";").join("\n");
const proposal = readFileSync("supabase/proposals/poll_multiple_selection_limit.sql", "utf8");
let change = proposal.slice(proposal.indexOf("alter table public.polls"), proposal.indexOf("revoke all on function"));
let tests = readFileSync("supabase/tests/poll_multiple_selection_limit.sql", "utf8");
tests = tests.slice(tests.indexOf("create temporary table qa_limit_originals"));
// Browser grants are checked against real tables separately after deployment.
tests = tests.replace(/^  assert not has_(?:function|any_column)_privilege[^\n]*\n/gm, "");
change += "\ncreate trigger poll_choice_selections_guard before insert or update on public.poll_choice_selections for each row execute function public.guard_poll_choice_selection();\n";
const sql = setup + (definitions + "\n" + triggers + "\n" + change + "\n" + tests).replaceAll("public.", "pg_temp.");
// All data mutations and function/table DDL must resolve to session temporary
// objects; only LIKE reads production definitions, and everything rolls back.
assert(!/\b(?:insert into|update|delete from|alter table|create (?:or replace )?function) public\./i.test(sql));
assert(sql.trim().endsWith("rollback;"));
process.stdout.write(sql);
