-- TEST ONLY. Run through scripts/test-project-database.mjs, never Production.
begin;
do $$ begin
  if exists(select 1 from public.participants where id='00000000-0000-4000-8000-000000000901')
    or exists(select 1 from public.project_admin_entries) then
    raise exception 'Use an isolated empty project-admin TEST state'; end if;
end $$;
insert into public.participants(id,display_name,is_active,display_order)
values('00000000-0000-4000-8000-000000000901','ISOLATED TEST',true,901);

do $$
declare actor uuid:='00000000-0000-4000-8000-000000000901'; n bigint; n2 bigint; v jsonb; history bigint;
begin
  if has_table_privilege('anon','public.project_admin_entries','SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated','public.project_admin_revisions','SELECT,INSERT,UPDATE,DELETE')
    or has_function_privilege('anon','public.get_project_home()','EXECUTE')
    or has_function_privilege('authenticated','public.change_project_entry(uuid,text,text,integer,text,jsonb,bigint)','EXECUTE') then
    raise exception 'Direct browser privileges must be revoked'; end if;
  perform public.change_project_entry(actor,'status','current',0,'save','{"phase":"TEST","goal":null,"nextAction":"TEST only","updatedAt":"2026-11-11","relatedLinks":[]}'::jsonb);
  begin perform public.change_project_entry(actor,'status','current',0,'save','null'::jsonb);raise exception 'Missing CAS conflict';exception when sqlstate 'P4090' then null;end;
  begin perform public.change_project_entry(actor,'status','current',1,'save','{"phase":"TEST","nextAction":"TEST","updatedAt":"2026-02-30"}'::jsonb);raise exception 'Invalid date accepted';exception when datetime_field_overflow or invalid_datetime_format or invalid_parameter_value then null;end;
  insert into public.board_posts(author_id,title,content,post_type,is_pinned) values(actor,'TEST decision','TEST only','notice',false) returning id into n;
  insert into public.board_posts(author_id,title,content,post_type,is_pinned) values(actor,'TEST successor','TEST only','notice',false) returning id into n2;
  perform public.change_project_entry(actor,'decision',n::text,0,'save','{"isVisible":true,"decidedOn":null,"relatedPollSlugs":[],"supersededBy":null}'::jsonb);
  perform public.change_project_entry(actor,'decision',n2::text,0,'save','{"isVisible":true,"decidedOn":null,"relatedPollSlugs":[],"supersededBy":null}'::jsonb);
  perform public.change_project_entry(actor,'decision',n::text,1,'save',jsonb_build_object('isVisible',true,'decidedOn',null,'relatedPollSlugs','[]'::jsonb,'supersededBy',n2::text));
  begin perform public.change_project_entry(actor,'decision',n2::text,1,'save',jsonb_build_object('isVisible',true,'decidedOn',null,'relatedPollSlugs','[]'::jsonb,'supersededBy',n::text));raise exception 'Replacement cycle accepted';exception when invalid_parameter_value then null;end;
  perform public.change_project_entry(actor,'event','00000000-0000-4000-8000-000000000911',0,'save','{"title":"TEST event","startsAt":"2099-01-01T00:00:00Z","location":"","description":"","href":null,"isVisible":true}'::jsonb);
  select id into history from public.project_admin_revisions where kind='event' order by id desc limit 1;
  perform public.change_project_entry(actor,'event','00000000-0000-4000-8000-000000000911',1,'delete');
  perform public.change_project_entry(actor,'event','00000000-0000-4000-8000-000000000911',2,'restore',null,history);
  v:=public.get_project_home();
  if jsonb_array_length(v->'events')<>1 or jsonb_array_length(v->'decisions')<>1 then raise exception 'HOME visibility/replacement failed';end if;
  if (select count(*) from public.project_admin_revisions)<7 then raise exception 'Missing history';end if;
end $$;
rollback;
