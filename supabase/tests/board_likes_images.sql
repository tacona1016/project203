-- ISOLATED TEST DB ONLY. Apply existing BOARD + edit RPC + proposal first.
-- No Storage objects are written here; these are SQL state/grant assertions.
-- New synthetic rows roll back; identity sequence increments do not roll back.
begin;
-- set local project203.test_database='on';
do $$ begin
  if current_setting('project203.test_database',true) is distinct from 'on' then raise exception 'Explicit TEST database confirmation required'; end if;
  if to_regprocedure('public.reserve_board_image(bigint,uuid,uuid,boolean,uuid,text,integer,integer,integer)') is null then raise exception 'Apply reviewed new SQL to TEST first'; end if;
end $$;
do $$ declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); inactive uuid:=gen_random_uuid(); post_id bigint; comment_id bigint;
begin
  insert into public.participants(id,display_name,is_active) values(a,'QA-photo-A-'||a::text,true),(b,'QA-photo-B-'||b::text,true),(inactive,'QA-photo-inactive-'||inactive::text,false);
  post_id:=(public.write_board_post(null,a,false,'Synthetic BOARD story','Synthetic text','general',false)->>'id')::bigint;
  comment_id:=(public.create_board_comment(post_id,a,'Synthetic comment')->>'id')::bigint;
  perform set_config('project203.board_extra_test',jsonb_build_object('a',a,'b',b,'inactive',inactive,'post',post_id,'comment',comment_id)::text,true);
end $$;
set local role service_role;
do $$
declare config jsonb:=current_setting('project203.board_extra_test')::jsonb;
  a uuid:=(config->>'a')::uuid; b uuid:=(config->>'b')::uuid; inactive uuid:=(config->>'inactive')::uuid;
  post_id bigint:=(config->>'post')::bigint; comment_id bigint:=(config->>'comment')::bigint;
  image_id uuid:=gen_random_uuid(); token uuid:=gen_random_uuid(); record jsonb; answer jsonb; n integer;
begin
  if current_user<>'service_role' then raise exception 'Backend role expected'; end if;
  perform public.set_board_like(post_id,null,a,true);perform public.set_board_like(post_id,null,a,true);
  answer:=public.set_board_like(post_id,null,b,true);
  if (answer->>'count')::integer<>2 then raise exception 'Duplicate or missing post like'; end if;
  perform public.set_board_like(post_id,comment_id,a,true);
  perform public.edit_board_comment(post_id,comment_id,a,'Edited synthetic comment');
  perform public.write_board_post(post_id,a,false,'Edited story','New synthetic body','general',false);
  answer:=public.get_board_engagement(post_id,a,array[comment_id]);
  if (answer#>>'{post,count}')::integer<>2 or (answer#>>array['comments',comment_id::text,'count'])::integer<>1 then raise exception 'Edits changed likes'; end if;
  if answer::text like '%'||a::text||'%' or answer::text like '%'||b::text||'%' then raise exception 'Reaction response exposes member IDs'; end if;
  perform public.set_board_like(post_id,null,a,false);answer:=public.set_board_like(post_id,null,a,false);
  if (answer->>'count')::integer<>1 then raise exception 'Unlike was not idempotent'; end if;
  begin perform public.set_board_like(post_id,null,inactive,true);raise exception 'Inactive like allowed';exception when sqlstate 'P4030' then null;end;
  begin perform public.edit_board_comment(post_id,comment_id,b,'Unauthorized');raise exception 'Other author edit allowed';exception when sqlstate 'P4030' then null;end;
  begin perform public.reserve_board_image(post_id,image_id,b,true,token,repeat('a',64),100,40,30);raise exception 'Other admin managed photos';exception when sqlstate 'P4030' then null;end;
  record:=public.reserve_board_image(post_id,image_id,a,false,token,repeat('a',64),100,40,30);
  begin perform public.reserve_board_image(post_id,image_id,a,false,gen_random_uuid(),repeat('b',64),100,40,30);raise exception 'Different bytes reused key';exception when sqlstate 'P4090' then null;end;
  record:=public.finish_board_image(post_id,image_id,a,false,token);
  if record->>'state'<>'ready' then raise exception 'Image not finalized'; end if;
  -- A late abort must NEVER claim/remove a finalized object.
  if public.abort_board_image(image_id,token) is not null then raise exception 'Ready image aborted'; end if;
  if public.claim_board_image_cleanup(image_id,gen_random_uuid()) is not null then raise exception 'Live ready image claimed for cleanup'; end if;
  if (public.reserve_board_image(post_id,image_id,a,false,gen_random_uuid(),repeat('a',64),100,40,30)->>'id')::uuid<>image_id then raise exception 'Ready replay changed identity'; end if;
  for n in 1..2 loop perform public.reserve_board_image(post_id,gen_random_uuid(),a,false,gen_random_uuid(),repeat('a',64),100,40,30);end loop;
  begin perform public.reserve_board_image(post_id,gen_random_uuid(),a,false,gen_random_uuid(),repeat('a',64),100,40,30);raise exception 'Fourth slot allowed';exception when sqlstate 'P4090' then null;end;
  perform public.write_board_post(post_id,a,false,'Edited again','Existing image is preserved','general',false);
  if jsonb_array_length(public.get_board_engagement(post_id,a,'{}')->'images')<>1 then raise exception 'Post edit removed image'; end if;
  record:=public.begin_board_image_delete(post_id,image_id,a,false,token);
  if record->>'state'<>'deleting' then raise exception 'Deletion not tracked'; end if;
  -- In the application Storage.remove must succeed before this DB purge.
  perform public.purge_board_image(image_id,token);
  if public.get_board_image(post_id,image_id) is not null then raise exception 'Deleted photo visible'; end if;
  perform public.delete_board_comment(post_id,comment_id,a,false);
  begin perform public.set_board_like(post_id,comment_id,a,true);raise exception 'Deleted comment liked';exception when sqlstate 'P4040' then null;end;
  perform public.delete_board_post(post_id,a,false);
  begin perform public.set_board_like(post_id,null,a,true);raise exception 'Deleted post liked';exception when sqlstate 'P4040' then null;end;
end $$;
reset role;
do $$ declare item text; begin
  foreach item in array array['board_post_likes','board_comment_likes','board_post_images'] loop
    if not exists(select 1 from pg_class where oid=('public.'||item)::regclass and relrowsecurity) then raise exception 'Missing RLS';end if;
    if has_table_privilege('anon','public.'||item,'SELECT') or has_table_privilege('authenticated','public.'||item,'INSERT') then raise exception 'Browser table access allowed';end if;
  end loop;
  if has_function_privilege('anon','public.set_board_like(bigint,bigint,uuid,boolean)','EXECUTE') or has_function_privilege('authenticated','public.get_board_engagement(bigint,uuid,bigint[])','EXECUTE') then raise exception 'Browser RPC access allowed';end if;
end $$;
rollback;

-- Additional TEST-only two-session check: send the same PUT concurrently, then
-- verify one composite-PK row; for photos race four different UUID reservations
-- on one TEST post and verify at most three slots. Roll back both connections.
-- HTTP fixtures serialize synthetic state and do not prove PostgreSQL locking.
