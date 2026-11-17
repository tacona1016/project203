import {readFileSync} from 'node:fs';
const sql=readFileSync('supabase/proposals/poll_images.sql','utf8');
const end=sql.indexOf('revoke all on function public.guard_poll_image()');
let transient=sql.slice(sql.indexOf('create table public.poll_images'),end).replaceAll('public.polls','pg_temp.polls').replaceAll('public.participants','pg_temp.participants').replaceAll('public.poll_options','pg_temp.poll_options').replaceAll('public.poll_images','pg_temp.poll_images').replaceAll('public.guard_poll_image','pg_temp.guard_poll_image').replaceAll('public.manage_poll_image','pg_temp.manage_poll_image').replace('create table pg_temp.poll_images','create temp table poll_images');
transient=transient.split('\n').filter(line=>!line.startsWith('revoke ')&&!line.startsWith('grant ')&&!line.startsWith('alter table')).join('\n');
const setup=`begin;\ncreate temp table participants(id uuid primary key,is_active boolean);\ncreate temp table polls(id bigint primary key,poll_type text);\ncreate temp table poll_options(id bigint primary key,poll_id bigint references pg_temp.polls(id),unique(poll_id,id));\n`;
const tests=`
do $$
declare actor uuid:='00000000-0000-4000-8000-000000000001'; inactive uuid:='00000000-0000-4000-8000-000000000002'; q uuid[]:=array[]::uuid[]; id1 uuid; id2 uuid; token uuid; item jsonb; n integer; req jsonb;
begin
  insert into pg_temp.participants values(actor,true),(inactive,false);
  insert into pg_temp.polls values(1,'choice'),(2,'choice'),(3,'text');
  insert into pg_temp.poll_options values(101,1),(102,1),(201,2);
  for n in 1..3 loop
    id1:=gen_random_uuid();token:=gen_random_uuid();q:=array_append(q,id1);
    req:=jsonb_build_object('id',id1,'token',token,'sha256',repeat('a',64),'byte_size',100,'width',10,'height',5);
    item:=pg_temp.manage_poll_image(1,actor,'reserve',req);assert item->>'state'='pending';
    perform pg_temp.manage_poll_image(1,actor,'finish',req);assert (pg_temp.manage_poll_image(1,actor,'reserve',req)->>'state')='ready';
  end loop;
  begin perform pg_temp.manage_poll_image(1,actor,'reserve',jsonb_build_object('id',gen_random_uuid(),'token',gen_random_uuid(),'sha256',repeat('a',64),'byte_size',100,'width',10,'height',5));raise exception 'fourth question accepted';exception when check_violation then null;end;
  perform pg_temp.manage_poll_image(1,actor,'reorder',jsonb_build_object('ids',array[q[3],q[2],q[1]]));
  assert (select sort_order=0 from pg_temp.poll_images where id=q[3]);
  begin perform pg_temp.manage_poll_image(1,actor,'reorder',jsonb_build_object('ids',array[q[1],q[1],q[3]]));raise exception 'duplicate reorder accepted';exception when serialization_failure then null;end;
  id1:=gen_random_uuid();token:=gen_random_uuid();req:=jsonb_build_object('id',id1,'token',token,'option_id',101,'sha256',repeat('b',64),'byte_size',100,'width',10,'height',5);
  perform pg_temp.manage_poll_image(1,actor,'reserve',req);
  begin perform pg_temp.manage_poll_image(1,actor,'finish',req||jsonb_build_object('token',gen_random_uuid()));raise exception 'bad lease accepted';exception when serialization_failure then null;end;
  perform pg_temp.manage_poll_image(1,actor,'finish',req);
  begin perform pg_temp.manage_poll_image(1,actor,'reserve',req||jsonb_build_object('id',gen_random_uuid()));raise exception 'second option accepted';exception when check_violation then null;end;
  id2:=gen_random_uuid();token:=gen_random_uuid();req:=req||jsonb_build_object('id',id2,'token',token,'replaces_id',id1);
  perform pg_temp.manage_poll_image(1,actor,'reserve',req);assert (select state='ready' from pg_temp.poll_images where id=id1);
  perform pg_temp.manage_poll_image(1,actor,'finish',req);assert (select state='deleting' from pg_temp.poll_images where id=id1);assert (select state='ready' from pg_temp.poll_images where id=id2);
  select upload_token into token from pg_temp.poll_images where id=id1;
  perform pg_temp.manage_poll_image(1,actor,'purge',jsonb_build_object('id',id1,'token',token));
  assert (pg_temp.manage_poll_image(1,actor,'reserve',req)->>'state')='ready';
  begin perform pg_temp.manage_poll_image(1,actor,'reserve',req||jsonb_build_object('id',gen_random_uuid(),'option_id',201,'replaces_id',null));raise exception 'foreign option accepted';exception when invalid_parameter_value then null;end;
  begin perform pg_temp.manage_poll_image(1,inactive,'reserve',req);raise exception 'inactive accepted';exception when insufficient_privilege then null;end;
  begin perform pg_temp.manage_poll_image(1,actor,'reserve',req||jsonb_build_object('id',gen_random_uuid(),'option_id',102,'replaces_id',null,'byte_size',500001));raise exception 'oversize accepted';exception when check_violation then null;end;
  perform pg_temp.manage_poll_image(3,actor,'reserve',req||jsonb_build_object('id',gen_random_uuid(),'option_id',null,'replaces_id',null));
  item:=pg_temp.manage_poll_image(1,actor,'delete',req||jsonb_build_object('token',gen_random_uuid()));assert item->>'state'='deleting';
  item:=pg_temp.manage_poll_image(1,actor,'purge',jsonb_build_object('id',id2,'token',item->>'upload_token'));assert (item->>'deleted')::boolean;
end $$;
select true as isolated_postgres_checks_passed, 'session temporary tables only; rolled back; no public app rows touched' as scope;
rollback;
`;
// Generate a session-only PostgreSQL check. No credentials or database access.
// Pass its SQL to a reviewed SQL client. It only touches pg_temp and ROLLBACKs.
process.stdout.write(setup+transient+tests);
