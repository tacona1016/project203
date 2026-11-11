import { spawnSync } from "node:child_process";
import { requireTestTarget } from "./backup/core.mjs";

try {
  requireTestTarget({reference:process.env.TEST_SUPABASE_REF,url:process.env.TEST_SUPABASE_URL,host:process.env.TEST_DB_HOST,confirmation:process.env.TEST_ENV_CONFIRM});
  if(!process.env.TEST_DB_USER||!process.env.TEST_DB_PASSWORD||!process.argv.includes('--confirm-test'))throw Error('missing_test_setup');
  const env={...process.env,PGHOST:process.env.TEST_DB_HOST,PGUSER:process.env.TEST_DB_USER,PGPASSWORD:process.env.TEST_DB_PASSWORD,PGDATABASE:'postgres',PGSSLMODE:'require'};
  const input=process.argv.includes('--apply-proposal')?'supabase/proposals/project_admin_content.sql':'supabase/tests/project_admin_content.sql';
  const r=spawnSync('psql',['-X','--no-password','--set','ON_ERROR_STOP=1','--file',input],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  if(r.status!==0)throw Error('test_sql_failed');
  console.log(JSON.stringify({status:'passed',target:'explicit_isolated_test',proposalApplied:process.argv.includes('--apply-proposal'),productionWrites:0}));
}catch{console.error(JSON.stringify({status:'not_verified',reason:'isolated_test_configuration_or_tool_required',productionWrites:0}));process.exitCode=1;}
