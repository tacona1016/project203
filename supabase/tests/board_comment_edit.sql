-- ISOLATED TEST DATABASE ONLY. Never run this against production.
-- Apply the existing BOARD schema and NEW board_comment_edit migration first.
-- Review the connection, then uncomment the explicit TEST confirmation below.
-- Fixture rows roll back. PostgreSQL identity/sequence increments DO NOT roll
-- back, so the test may leave gaps even though no fixture rows remain.
-- This tests DB grants/RPC rules, not the Next.js member-session boundary.
-- Run as the TEST database owner (for synthetic participant setup). If any
-- assertion fails, execute ROLLBACK before continuing in that SQL connection.
begin;
-- set local project203.test_database = 'on';

do $$ begin
  if current_setting('project203.test_database',true) is distinct from 'on' then
    raise exception 'Isolated TEST database confirmation required';
  end if;
  if to_regprocedure('public.edit_board_comment(bigint,bigint,uuid,text)') is null then
    raise exception 'Apply the new board_comment_edit migration to the TEST database first';
  end if;
  if has_function_privilege('anon','public.edit_board_comment(bigint,bigint,uuid,text)','EXECUTE')
    or has_function_privilege('authenticated','public.edit_board_comment(bigint,bigint,uuid,text)','EXECUTE')
    or not has_function_privilege('service_role','public.edit_board_comment(bigint,bigint,uuid,text)','EXECUTE') then
    raise exception 'Invalid board comment edit RPC grants';
  end if;
end $$;

-- Only generated synthetic IDs are used; no existing member or content row is
-- selected as a fixture. Session-local settings pass these IDs without output.
do $$
declare qa_a uuid:=gen_random_uuid(); qa_b uuid:=gen_random_uuid(); qa_inactive uuid:=gen_random_uuid();
  qa_post bigint; qa_other_post bigint; qa_comment bigint; qa_created timestamptz;
begin
  insert into public.participants(id,display_name,is_active) values
    (qa_a,'QA-edit-A-'||qa_a::text,true),
    (qa_b,'QA-edit-B-'||qa_b::text,true),
    (qa_inactive,'QA-edit-inactive-'||qa_inactive::text,false);
  qa_post:=(public.write_board_post(null,qa_a,false,'QA comment edit story','Synthetic TEST content','general',false)->>'id')::bigint;
  qa_other_post:=(public.write_board_post(null,qa_b,false,'QA other story','Synthetic TEST content','general',false)->>'id')::bigint;
  qa_comment:=(public.create_board_comment(qa_post,qa_a,'Original synthetic comment')->>'id')::bigint;
  select created_at into qa_created from public.board_post_comments where id=qa_comment;
  perform set_config('project203.qa_board_edit',jsonb_build_object(
    'a',qa_a,'b',qa_b,'inactive',qa_inactive,'post',qa_post,
    'other_post',qa_other_post,'comment',qa_comment,'created_at',qa_created
  )::text,true);
end $$;

-- Exercise the RPC with exactly the backend DB role, not superuser bypass.
set local role service_role;
do $$
declare qa_config jsonb:=current_setting('project203.qa_board_edit')::jsonb;
  qa_a uuid:=(qa_config->>'a')::uuid;
  qa_b uuid:=(qa_config->>'b')::uuid;
  qa_inactive uuid:=(qa_config->>'inactive')::uuid;
  qa_post bigint:=(qa_config->>'post')::bigint;
  qa_other_post bigint:=(qa_config->>'other_post')::bigint;
  qa_comment bigint:=(qa_config->>'comment')::bigint;
  qa_result jsonb; qa_snapshot jsonb; qa_bad text;
  qa_expected text:='한글 😀'||E'\n'||'끝';
begin
  if current_user<>'service_role' then raise exception 'Tests must execute as the server DB role'; end if;

  qa_result:=public.edit_board_comment(qa_post,qa_comment,qa_a,'  '||qa_expected||'  ');
  if (qa_result->>'id')::bigint is distinct from qa_comment
    or qa_result->>'content' is distinct from qa_expected
    or (qa_result->>'updated_at')::timestamptz is null then
    raise exception 'Successful own edit returned an invalid response';
  end if;
  if not exists(select 1 from public.board_post_comments c where c.id=qa_comment
    and c.post_id=qa_post and c.author_id=qa_a and c.deleted_at is null
    and c.created_at=(qa_config->>'created_at')::timestamptz
    and c.updated_at=(qa_result->>'updated_at')::timestamptz
    and c.updated_at>c.created_at and c.content=qa_expected) then
    raise exception 'Own edit changed identity/created time or failed to touch updated time';
  end if;

  -- char_length counts both a Korean character and a basic emoji as one.
  qa_result:=public.edit_board_comment(qa_post,qa_comment,qa_a,repeat('가',2000));
  if char_length(qa_result->>'content')<>2000 then raise exception 'Korean boundary edit failed'; end if;
  qa_result:=public.edit_board_comment(qa_post,qa_comment,qa_a,repeat('😀',2000));
  if char_length(qa_result->>'content')<>2000 or (qa_result->>'id')::bigint<>qa_comment then
    raise exception 'Emoji boundary edit failed';
  end if;
  select to_jsonb(c) into qa_snapshot from public.board_post_comments c where c.id=qa_comment;

  begin
    perform public.edit_board_comment(qa_post,qa_comment,qa_b,'Unauthorized synthetic edit');
    raise exception 'Another active member edited the comment';
  exception when sqlstate 'P4030' then null; end;
  begin
    perform public.edit_board_comment(qa_post,qa_comment,qa_inactive,'Inactive synthetic edit');
    raise exception 'An inactive member edited the comment';
  exception when sqlstate 'P4030' then null; end;
  begin
    perform public.edit_board_comment(qa_other_post,qa_comment,qa_a,'Wrong parent synthetic edit');
    raise exception 'A comment was edited under another post';
  exception when sqlstate 'P4040' then null; end;
  foreach qa_bad in array array[null::text,'',E' \t\n\r',repeat('가',2001),repeat('😀',2001)] loop
    begin
      perform public.edit_board_comment(qa_post,qa_comment,qa_a,qa_bad);
      raise exception 'An empty or oversized response was accepted';
    exception when sqlstate '22023' then null; end;
  end loop;
  if (select to_jsonb(c) from public.board_post_comments c where c.id=qa_comment) is distinct from qa_snapshot then
    raise exception 'Rejected edits partially changed the comment';
  end if;

  perform public.delete_board_post(qa_post,qa_a,false);
  begin
    perform public.edit_board_comment(qa_post,qa_comment,qa_a,'Deleted parent synthetic edit');
    raise exception 'A deleted parent accepted a comment edit';
  exception when sqlstate 'P4040' then null; end;
  if (select to_jsonb(c) from public.board_post_comments c where c.id=qa_comment) is distinct from qa_snapshot then
    raise exception 'Rejected deleted-parent edit changed the comment';
  end if;

  -- Restore ONLY this generated TEST parent to exercise the independent
  -- deleted-comment case. The whole transaction still rolls back below.
  update public.board_posts set deleted_at=null where id=qa_post;
  perform public.delete_board_comment(qa_post,qa_comment,qa_a,false);
  select to_jsonb(c) into qa_snapshot from public.board_post_comments c where c.id=qa_comment;
  begin
    perform public.edit_board_comment(qa_post,qa_comment,qa_a,'Deleted comment synthetic edit');
    raise exception 'A deleted comment accepted an edit';
  exception when sqlstate 'P4040' then null; end;
  if (select to_jsonb(c) from public.board_post_comments c where c.id=qa_comment) is distinct from qa_snapshot then
    raise exception 'Rejected edit changed or resurrected a deleted comment';
  end if;
end $$;
reset role;
rollback;
