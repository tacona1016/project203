-- TEST DATABASE ONLY. Apply 20261101000000_choice_ballots.sql first.
-- Never run against production. Confirm the isolated DB, then uncomment SET.
-- All fixture rows, trigger changes and grants roll back at the end.
-- These SQL assertions require PostgreSQL; npm's synthetic fixtures do not run them.
begin;
-- set local project203.test_database = 'on';
do $$ begin
  if current_setting('project203.test_database',true) is distinct from 'on' then
    raise exception 'Isolated TEST database confirmation required';
  end if;
end $$;

create temporary table qa_original_choice_rows as
  select id,to_jsonb(v) row_data from public.votes v where option_id is not null;

-- Inject one deliberate failure AFTER a replacement has started. Its exception
-- must roll back every deselection/upsert in submit_choice_ballot atomically.
create or replace function pg_temp.qa_fail_selected_option() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.is_selected and new.option_id::text=current_setting('project203.qa_fail_option',true) then
    raise exception using errcode='23514',message='Synthetic atomic replacement failure';
  end if;
  return new;
end $$;
create trigger zz_qa_fail_selected_option before insert or update on public.poll_choice_selections
for each row execute function pg_temp.qa_fail_selected_option();

do $$
declare person uuid:=gen_random_uuid(); other_person uuid:=gen_random_uuid(); inactive uuid:=gen_random_uuid();
  input jsonb; multi_input jsonb; single_id bigint; multi_id bigint; text_id bigint; other_id bigint;
  single_slug text; multi_slug text; text_slug text; other_slug text;
  a bigint; b bigint; c bigint; single_a bigint; single_b bigint; foreign_option bigint;
  result jsonb; before_result jsonb; captured boolean;
begin
  if has_table_privilege('anon','public.poll_choice_selections','SELECT')
    or has_table_privilege('authenticated','public.poll_choice_selections','INSERT')
    or has_any_column_privilege('anon','public.poll_choice_selections','SELECT')
    or has_any_column_privilege('authenticated','public.poll_choice_selections','SELECT')
    or has_function_privilege('anon','public.submit_choice_ballot(bigint,bigint[],uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.get_poll_participation(bigint,uuid)','EXECUTE')
    or has_function_privilege('anon','public.get_poll_legacy_results(bigint)','EXECUTE') then
    raise exception 'Browser permission leaked';
  end if;
  if not(select relrowsecurity from pg_class where oid='public.poll_choice_selections'::regclass)
    or not has_function_privilege('service_role','public.submit_choice_ballot(bigint,bigint[],uuid)','EXECUTE') then
    raise exception 'Missing server grants or RLS';
  end if;
  insert into public.participants(id,display_name,is_active) values
    (person,'QA-ballot-'||person,true),(other_person,'QA-ballot-'||other_person,true),(inactive,'QA-ballot-'||inactive,false);
  input:=jsonb_build_object('quarter','2026-q4','title','QA single selection','description','','poll_type','choice',
    'results_visibility','live','text_max_length',1000,'vote_mode','single','allow_vote_change',false,
    'is_hidden',false,'voting_starts_at',null,'voting_ends_at',null,'options','["A","B","C"]'::jsonb);
  single_slug:=public.admin_create_poll(input)->>'slug';
  select id into single_id from public.polls where slug=single_slug;
  select min(id),max(id) into single_a,single_b from public.poll_options where poll_id=single_id;
  multi_input:=input||'{"title":"QA multiple selection","vote_mode":"multiple","allow_vote_change":false,"results_visibility":"after_close"}'::jsonb;
  multi_slug:=public.admin_create_poll(multi_input)->>'slug';
  select id into multi_id from public.polls where slug=multi_slug;
  select min(id),min(id)+1,max(id) into a,b,c from public.poll_options where poll_id=multi_id;
  -- Identity sequences need not be contiguous: use display order for the middle.
  select id into b from public.poll_options where poll_id=multi_id order by display_order,id offset 1 limit 1;
  other_slug:=public.admin_create_poll(input||'{"title":"QA other poll"}'::jsonb)->>'slug';
  select id into other_id from public.polls where slug=other_slug;
  select min(id) into foreign_option from public.poll_options where poll_id=other_id;
  text_slug:=public.admin_create_poll(input||'{"poll_type":"text","title":"QA text unchanged","allow_vote_change":true,"options":[]}'::jsonb)->>'slug';
  select id into text_id from public.polls where slug=text_slug;

  if public.submit_choice_ballot(multi_id,'{}'::bigint[],person)->>'status'<>'invalid_selection'
    or public.submit_choice_ballot(multi_id,array[a,null],person)->>'status'<>'invalid_selection'
    or public.submit_choice_ballot(single_id,array[single_a,single_b],person)->>'status'<>'invalid_selection'
    or public.submit_choice_ballot(multi_id,array[a,foreign_option],person)->>'status'<>'invalid_option'
    or public.submit_choice_ballot(multi_id,array[a],inactive)->>'status'<>'inactive_participant'
    or public.submit_choice_ballot(text_id,array[a],person)->>'status'<>'invalid_poll_type' then
    raise exception 'Invalid ballot accepted';
  end if;
  if exists(select 1 from public.poll_choice_selections where poll_id=multi_id) then raise exception 'Invalid ballot partially saved'; end if;
  if public.submit_choice_ballot(single_id,array[single_a,single_a],person)->>'status'<>'success' then raise exception 'Single duplicate-array normalization failed'; end if;
  if public.submit_vote(single_id,single_b,person)->>'status'<>'already_voted' then raise exception 'Single first-only policy bypassed'; end if;
  perform public.admin_update_poll(single_id,input||'{"allow_vote_change":true}'::jsonb);
  if public.submit_vote(single_id,single_b,person)->>'status'<>'vote_changed' then raise exception 'Single compatibility wrapper failed'; end if;
  if (public.get_poll_results(single_id)->>'total_votes')::integer<>1 then raise exception 'Single change added another selected vote'; end if;
  captured:=false;
  begin
    insert into public.poll_choice_selections(poll_id,participant_id,option_id) values(single_id,person,single_a);
  exception when invalid_parameter_value then captured:=true; end;
  if not captured then raise exception 'Single trigger accepted another active selection'; end if;

  if public.submit_choice_ballot(multi_id,array[b,a,a],person)->>'status'<>'success' then raise exception 'Multiple batch failed'; end if;
  captured:=false;
  begin
    insert into public.poll_choice_selections(poll_id,participant_id,option_id) values(multi_id,person,a);
  exception when unique_violation then captured:=true; end;
  if not captured then raise exception 'Canonical per-option PRIMARY KEY failed'; end if;
  result:=public.get_poll_results(multi_id);
  if (result->>'total_votes')::integer<>2 or (result->>'participant_count')::integer<>1 then raise exception 'Multiple per-option count wrong'; end if;
  if public.submit_choice_ballot(multi_id,array[c],person)->>'status'<>'already_voted'
    or public.submit_vote(multi_id,c,person)->>'status'<>'invalid_selection' then raise exception 'Old append or frozen set bypassed'; end if;
  if public.get_poll_detail(multi_slug,false)->'results'<>'null'::jsonb then raise exception 'After-close choices leaked'; end if;
  result:=public.get_poll_participation(multi_id,person);
  if result->'option_ids'<>to_jsonb(array[a,b]) or (result->>'vote_count')::integer<>2
    or (result->>'selection_count')::integer<>2 or not(result->>'has_participated')::boolean then
    raise exception 'Own selection set missing';
  end if;
  if public.get_poll_participation(multi_id,other_person)->'option_ids'<>'[]'::jsonb then raise exception 'Other participant record mixed'; end if;
  perform public.admin_update_poll(multi_id,multi_input||'{"allow_vote_change":true}'::jsonb);
  if not(select allow_vote_change from public.polls where id=multi_id) then raise exception 'Multiple change setting reset'; end if;
  if public.submit_choice_ballot(multi_id,array[c,b],person)->>'status'<>'vote_changed' then raise exception 'Set replacement failed'; end if;
  if public.submit_choice_ballot(multi_id,array[b,c,c],person)->>'status'<>'unchanged' then raise exception 'Equivalent set was not idempotent'; end if;
  if (public.get_poll_results(multi_id)->'counts') ? a::text then raise exception 'Deselected option still counted'; end if;
  if public.submit_choice_ballot(multi_id,array[a],other_person)->>'status'<>'success' then raise exception 'Other participant blocked'; end if;
  result:=public.get_poll_results(multi_id);
  if (result->>'total_votes')::integer<>3 or (result->>'participant_count')::integer<>2 then raise exception 'Participants and selections confused'; end if;

  -- Failure while adding C must restore A/B, including their selection flags.
  if public.submit_choice_ballot(multi_id,array[a,b],person)->>'status'<>'vote_changed' then raise exception 'Atomic fixture setup failed'; end if;
  before_result:=public.get_poll_participation(multi_id,person);
  perform set_config('project203.qa_fail_option',c::text,true);
  captured:=false;
  begin
    perform public.submit_choice_ballot(multi_id,array[a,c],person);
  exception when check_violation then captured:=true; end;
  perform set_config('project203.qa_fail_option','',true);
  if not captured or public.get_poll_participation(multi_id,person)<>before_result then raise exception 'Partial replacement survived failed RPC'; end if;

  captured:=false;
  begin perform public.admin_update_poll(multi_id,multi_input||'{"quarter":"2027-q1"}'::jsonb);
  exception when sqlstate 'P2031' then captured:=true; end;
  if not captured then raise exception 'Responded canonical poll changed quarter'; end if;
  captured:=false;
  begin perform public.admin_update_poll(multi_id,multi_input||'{"vote_mode":"single"}'::jsonb);
  exception when sqlstate 'P2032' then captured:=true; end;
  if not captured then raise exception 'Responded canonical poll changed mode'; end if;
  captured:=false;
  begin perform public.admin_update_poll(multi_id,multi_input||'{"options":["changed","B","C"]}'::jsonb);
  exception when sqlstate 'P2032' then captured:=true; end;
  if not captured then raise exception 'Responded canonical options changed'; end if;

  perform public.admin_set_poll_state(multi_id,'close');
  if public.get_poll_detail(multi_slug,false)->'results'='null'::jsonb
    or public.submit_choice_ballot(multi_id,array[c],person)->>'status'<>'poll_closed' then raise exception 'Close result/submit policy failed'; end if;
  perform public.admin_set_poll_state(multi_id,'reopen');
  if public.get_poll_detail(multi_slug,false)->'results'<>'null'::jsonb then raise exception 'Reopen exposed private results'; end if;
  perform public.admin_set_poll_state(multi_id,'hide');
  if public.submit_choice_ballot(multi_id,array[c],person)->>'status'<>'poll_not_found' then raise exception 'Hidden vote accepted'; end if;
  perform public.admin_set_poll_state(multi_id,'unhide');
  perform public.admin_update_poll(multi_id,multi_input||jsonb_build_object('voting_starts_at',clock_timestamp()+interval '1 day','voting_ends_at',clock_timestamp()+interval '2 days'));
  if public.submit_choice_ballot(multi_id,array[c],person)->>'status'<>'poll_upcoming' then raise exception 'Upcoming vote accepted'; end if;
  perform public.admin_update_poll(multi_id,multi_input||jsonb_build_object('voting_starts_at',clock_timestamp()-interval '2 days','voting_ends_at',clock_timestamp()-interval '1 day'));
  if public.submit_choice_ballot(multi_id,array[c],person)->>'status'<>'poll_closed'
    or public.get_poll_detail(multi_slug,false)->'results'='null'::jsonb then raise exception 'Period end failed'; end if;
  perform public.admin_update_poll(multi_id,multi_input||'{"allow_vote_change":true}'::jsonb);

  if public.submit_text_response(text_id,person,'original response')->>'status'<>'success'
    or public.submit_text_response(text_id,person,'updated response')->>'status'<>'vote_changed'
    or public.get_poll_participation(text_id,person)->>'text_response'<>'updated response' then raise exception 'Text response regressed'; end if;
  if exists(select 1 from public.votes where poll_id in(single_id,multi_id)) then raise exception 'New choices wrote legacy archive'; end if;
  if exists((select id,to_jsonb(v) from public.votes v where option_id is not null)
    except(select id,row_data from qa_original_choice_rows))
    or exists((select id,row_data from qa_original_choice_rows)
    except(select id,to_jsonb(v) from public.votes v where option_id is not null)) then
    raise exception 'Original choice rows changed';
  end if;
  perform set_config('project203.qa_poll',multi_id::text,true);
  perform set_config('project203.qa_person',person::text,true);
  perform set_config('project203.qa_options',array[a,c]::text,true);
end $$;

-- Invoker/RLS permissions with the actual server role, not only the table owner.
set local role service_role;
do $$ begin
  if public.submit_choice_ballot(current_setting('project203.qa_poll')::bigint,
    current_setting('project203.qa_options')::bigint[],current_setting('project203.qa_person')::uuid)->>'status'<>'vote_changed' then
    raise exception 'Service-role replacement failed';
  end if;
  if public.get_poll_participation(current_setting('project203.qa_poll')::bigint,
    current_setting('project203.qa_person')::uuid)->'option_ids'<>to_jsonb(current_setting('project203.qa_options')::bigint[]) then
    raise exception 'Service-role participation failed';
  end if;
end $$;
reset role;
set local role anon;
do $$ declare denied boolean:=false;
begin
  begin perform 1 from public.poll_choice_selections;
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Anonymous table read allowed'; end if;
  denied:=false;
  begin perform public.submit_choice_ballot(current_setting('project203.qa_poll')::bigint,
    current_setting('project203.qa_options')::bigint[],current_setting('project203.qa_person')::uuid);
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Anonymous vote RPC allowed'; end if;
end $$;
reset role;
rollback;

-- TRUE CONCURRENCY CHECK (manual, two SQL sessions in an ISOLATED TEST DB):
-- 1. Create/commit one fresh active multiple fixture, two options, an active test
--    member; allow_vote_change=false. Record fixture IDs locally, never secrets.
-- 2. Session A: BEGIN; SELECT submit_choice_ballot(POLL, ARRAY[A,B], MEMBER);
--    Expect success. Keep this transaction open while starting Session B.
-- 3. Session B: BEGIN; SELECT submit_choice_ballot(POLL, ARRAY[B], MEMBER);
--    It must wait on A's poll lock. Session A: COMMIT.
--    B must return already_voted; ROLLBACK B. Exactly A/B remain selected once.
-- 4. Enable allow_vote_change=true in this TEST fixture. Repeat with sets [A] and
--    [B]. Both may succeed sequentially; final state must be B alone, never A+B.
-- 5. A: BEGIN; SELECT ... ARRAY[A]; B waits on ARRAY[A,A]. COMMIT A; COMMIT B.
--    B returns unchanged, and selected (poll,member,A) has exactly one row.
-- 6. Query get_poll_participation/get_poll_results and compare the immutable
--    legacy votes snapshot. Dispose of the isolated DB, not production data.
-- No true concurrent PostgreSQL execution is implied by npm fixture tests.
