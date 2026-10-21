-- 최신 participants_and_vote_modes migration 적용 후 실행하는 DB 회귀 테스트입니다.
-- 모든 시험 데이터는 끝에서 롤백하며 운영 기록을 삭제하지 않습니다.
begin;
set local statement_timeout = '20s';
do $test$
declare
  pa uuid; pb uuid; inactive uuid;
  single_poll bigint; repeat_poll bigint;
  single_option bigint; repeat_option bigint;
  response jsonb;
  i integer;
begin
  if exists(select 1 from public.votes where participant_id is null) then raise exception 'Unmapped vote'; end if;
  if exists(select 1 from public.comments where participant_id is null) then raise exception 'Unmapped comment'; end if;
  if has_any_column_privilege('anon','public.votes','INSERT') then raise exception 'Direct vote insert still allowed'; end if;
  if has_column_privilege('anon','public.comments','participant_name','INSERT') then raise exception 'Legacy comment name insert allowed'; end if;
  if has_any_column_privilege('anon','public.participants','UPDATE') then raise exception 'Participant update allowed'; end if;
  if not has_function_privilege('anon','public.submit_vote(bigint,bigint,uuid)','EXECUTE') then raise exception 'Missing RPC grant'; end if;
  if has_function_privilege('authenticated','public.submit_vote(bigint,bigint,uuid)','EXECUTE') then raise exception 'Unexpected authenticated grant'; end if;

  insert into public.participants(display_name) values ('qa-a-' || gen_random_uuid()) returning id into pa;
  insert into public.participants(display_name) values ('qa-b-' || gen_random_uuid()) returning id into pb;
  insert into public.participants(display_name,is_active) values ('qa-inactive-' || gen_random_uuid(),false) returning id into inactive;
  insert into public.polls(quarter,title,slug,allow_repeat_vote) values ('2099-q4','QA single','qa-single-' || gen_random_uuid(),false) returning id into single_poll;
  insert into public.polls(quarter,title,slug,allow_repeat_vote) values ('2099-q4','QA repeat','qa-repeat-' || gen_random_uuid(),true) returning id into repeat_poll;
  insert into public.poll_options(poll_id,label,display_order) values (single_poll,'QA option',1) returning id into single_option;
  insert into public.poll_options(poll_id,label,display_order) values (repeat_poll,'QA option',1) returning id into repeat_option;
  perform set_config('project203.qa', jsonb_build_object('pa',pa,'pb',pb,'inactive',inactive,'single_poll',single_poll,'repeat_poll',repeat_poll,'single_option',single_option,'repeat_option',repeat_option)::text,true);
end $test$;

set local role anon;
do $test$
declare
  fixtures jsonb := current_setting('project203.qa')::jsonb;
  pa uuid := (fixtures->>'pa')::uuid;
  pb uuid := (fixtures->>'pb')::uuid;
  inactive uuid := (fixtures->>'inactive')::uuid;
  sp bigint := (fixtures->>'single_poll')::bigint;
  rp bigint := (fixtures->>'repeat_poll')::bigint;
  so bigint := (fixtures->>'single_option')::bigint;
  ro bigint := (fixtures->>'repeat_option')::bigint;
  response jsonb;
  i integer;
begin
  response := public.submit_vote(sp,so,pa);
  if response->>'status' <> 'success' then raise exception 'First vote failed: %',response; end if;
  response := public.submit_vote(sp,so,pa);
  if response->>'status' <> 'already_voted' then raise exception 'Duplicate not rejected: %',response; end if;
  response := public.submit_vote(sp,so,pb);
  if response->>'status' <> 'success' then raise exception 'Other participant failed'; end if;
  response := public.submit_vote(sp,ro,pa);
  if response->>'status' <> 'invalid_option' then raise exception 'Cross-poll option accepted'; end if;
  response := public.submit_vote(sp,so,inactive);
  if response->>'status' <> 'inactive_participant' then raise exception 'Inactive participant accepted'; end if;
  response := public.submit_vote(-1,so,pa);
  if response->>'status' <> 'poll_not_found' then raise exception 'Missing poll accepted'; end if;
  for i in 1..3 loop
    response := public.submit_vote(rp,ro,pa);
    if response->>'status' <> 'success' then raise exception 'Repeat vote failed'; end if;
  end loop;
  response := public.get_poll_results(rp);
  if response->>'participant_count' <> '1' or response->>'total_votes' <> '3' then raise exception 'Repeat counts incorrect: %',response; end if;
  response := public.get_poll_results(sp);
  if response->>'participant_count' <> '2' or response->>'total_votes' <> '2' then raise exception 'Single counts incorrect: %',response; end if;

  insert into public.comments(quarter,participant_id,content) values ('2099-q4',pa,'QA rollback comment');
  if not exists(select 1 from public.comments c join public.participants p on p.id=c.participant_id where c.quarter='2099-q4' and p.id=pa) then raise exception 'Comment join failed'; end if;
  begin
    insert into public.comments(quarter,participant_id,content) values ('2099-q4',inactive,'Should fail');
    raise exception 'Inactive comment accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.comments(quarter,participant_id,content) values ('2099-q4',pa,'   ');
    raise exception 'Blank comment accepted';
  exception when check_violation then null; end;
  begin
    insert into public.comments(quarter,participant_id,content) values ('2099-q4',pa,repeat('a',1001));
    raise exception 'Oversized comment accepted';
  exception when check_violation then null; end;
  begin
    insert into public.votes(poll_id,option_id,participant_id) values (sp,so,pb);
    raise exception 'Direct vote insert accepted';
  exception when insufficient_privilege then null; end;
end $test$;
reset role;

rollback;
