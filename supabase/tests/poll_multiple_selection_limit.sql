-- ISOLATED TEST DATABASE ONLY, after applying the new proposal there.
-- Run with scripts/test-poll-choice-limit.mjs. Never production.
-- Test rows/temporary trigger are rolled back; sequence increments are not.
begin;
do $$ begin
  if current_setting('project203.test_database',true) is distinct from 'on' then
    raise exception 'Independent TEST database confirmation required';
  end if;
end $$;
create temporary table qa_limit_originals as
select 'polls' as kind,id::text as key,to_jsonb(p) as data from public.polls p
union all select 'options',id::text,to_jsonb(o) from public.poll_options o
union all select 'votes',id::text,to_jsonb(v) from public.votes v
union all select 'selections',poll_id||'/'||participant_id||'/'||option_id,to_jsonb(s) from public.poll_choice_selections s
union all select 'people',id::text,to_jsonb(p) from public.participants p;

create function pg_temp.qa_limit_fail() returns trigger language plpgsql set search_path='' as $$
begin
  if new.is_selected and new.option_id::text=current_setting('project203.qa_fail_option',true) then
    raise exception using errcode='23514',message='Intentional replacement failure';
  end if;
  return new;
end $$;
create trigger zz_qa_limit_fail before insert or update on public.poll_choice_selections
for each row execute function pg_temp.qa_limit_fail();

do $$
declare person uuid:=gen_random_uuid(); other_person uuid:=gen_random_uuid(); inactive uuid:=gen_random_uuid();
  input jsonb; request jsonb; result jsonb; before_state jsonb; created_slug text; pid bigint; ids bigint[]; n integer; k integer; bad jsonb; caught boolean; foreign_id bigint;
begin
  insert into public.participants(id,display_name,is_active) values
    (person,'QA-limit-'||person,true),(other_person,'QA-limit-'||other_person,true),(inactive,'QA-limit-'||inactive,false);
  input:=jsonb_build_object('quarter','2026-q4','title','TEST maximum choices','description','','poll_type','choice','vote_mode','multiple',
    'text_max_length',1000,'results_visibility','after_close','allow_vote_change',true,'is_hidden',false,
    'voting_starts_at',null,'voting_ends_at',null,'options','["A","B","C","D","E"]'::jsonb);
  for bad in select value from jsonb_array_elements('[1,6,-2,2.5,"3",false,{},[]]'::jsonb) loop
    caught:=false;
    begin perform public.admin_create_poll(input||jsonb_build_object('max_choices_per_participant',bad));
    exception when invalid_parameter_value then caught:=true; end;
    assert caught,'Invalid configured limit accepted';
  end loop;
  foreach request in array array[
    input||'{"vote_mode":"single","max_choices_per_participant":2}'::jsonb,
    input||'{"poll_type":"text","vote_mode":"single","options":[],"max_choices_per_participant":2}'::jsonb,
    input||'{"options":["A","B"],"max_choices_per_participant":3}'::jsonb
  ] loop
    caught:=false;
    begin perform public.admin_create_poll(request); exception when invalid_parameter_value then caught:=true; end;
    assert caught,'Incompatible configuration accepted';
  end loop;

  for n in 2..5 loop
    request:=input||jsonb_build_object('max_choices_per_participant',n);
    created_slug:=public.admin_create_poll(request)->>'slug';
    select id into pid from public.polls where polls.slug=created_slug;
    select array_agg(id order by display_order,id) into ids from public.poll_options where poll_id=pid;
    set constraints all immediate; set constraints all deferred;
    assert (public.get_poll_detail(created_slug,true)->'poll'->>'max_choices_per_participant')::integer=n,'Limit not persisted';
    for k in 1..n loop
      result:=public.submit_choice_ballot(pid,ids[1:k],person);
      assert result->>'status'=case when k=1 then 'success' else 'vote_changed' end,'1..N rejected';
      assert (public.get_poll_participation(pid,person)->>'selection_count')::integer=k,'Incorrect count';
    end loop;
    before_state:=public.get_poll_participation(pid,person);
    if n<5 then
      assert public.submit_choice_ballot(pid,ids[1:n+1],person)->>'status'='selection_limit_exceeded','N+1 accepted';
      assert before_state=public.get_poll_participation(pid,person),'Rejected RPC modified selections';
    end if;
    assert public.submit_choice_ballot(pid,array[ids[1],ids[1]],other_person)->>'status'='success','Distinct normalization failed';
    assert public.submit_choice_ballot(pid,array[ids[1]],other_person)->>'status'='unchanged','Replay appended';
    assert public.submit_choice_ballot(pid,array[ids[1]],inactive)->>'status'='inactive_participant';
    assert public.submit_choice_ballot(pid,array[-1::bigint],person)->>'status'='invalid_option';
    assert public.get_poll_detail(created_slug,false)->'results'='null'::jsonb,'Hidden results leaked';
    assert not(public.get_poll_detail(created_slug,false) ? 'has_responses'),'History flag leaked to member';
    assert (public.get_poll_detail(created_slug,true)->>'has_responses')::boolean,'Admin history missing';
    caught:=false;
    begin perform public.admin_update_poll(pid,request||'{"max_choices_per_participant":null}'::jsonb);
    exception when sqlstate 'P2035' then caught:=true; end;
    assert caught,'Voted setting changed';
    -- Old clients omit the new field: preserve it and option IDs.
    perform public.admin_update_poll(pid,input||'{"options":[]}'::jsonb);
    assert (select max_choices_per_participant=n from public.polls where id=pid);
    assert ids=(select array_agg(id order by display_order,id) from public.poll_options where poll_id=pid),'Option IDs recreated';
    -- Disabled change policy still applies.
    perform public.admin_update_poll(pid,request||'{"options":[],"allow_vote_change":false}'::jsonb);
    assert public.submit_choice_ballot(pid,array[ids[2]],person)->>'status'='already_voted';
    perform public.admin_update_poll(pid,request||'{"options":[],"allow_vote_change":true}'::jsonb);
    set constraints all immediate; set constraints all deferred;
  end loop;

  -- Unlimited old polls can still select all five; no implicit cap.
  created_slug:=public.admin_create_poll(input)->>'slug';
  select id into pid from public.polls where polls.slug=created_slug;
  select array_agg(id order by display_order,id) into ids from public.poll_options where poll_id=pid;
  assert (select max_choices_per_participant is null from public.polls where id=pid);
  assert public.submit_choice_ballot(pid,ids,person)->>'status'='success';
  foreign_id:=ids[1];

  -- Unvoted settings may change; same labels preserve the original option IDs.
  created_slug:=public.admin_create_poll(input||'{"max_choices_per_participant":3}'::jsonb)->>'slug';
  select id into pid from public.polls where polls.slug=created_slug;
  select array_agg(id order by display_order,id) into ids from public.poll_options where poll_id=pid;
  perform public.admin_update_poll(pid,input||'{"max_choices_per_participant":5}'::jsonb);
  perform public.admin_update_poll(pid,input||'{"max_choices_per_participant":2}'::jsonb);
  assert public.submit_choice_ballot(pid,array[ids[1],foreign_id],person)->>'status'='invalid_option';
  assert public.submit_choice_ballot(pid,ids[1:2],person)->>'status'='success';
  set constraints all immediate; set constraints all deferred;
  -- Direct service writes with temporary over-count are legal when final set fits.
  insert into public.poll_choice_selections(poll_id,participant_id,option_id,is_selected) values(pid,person,ids[3],true);
  update public.poll_choice_selections set is_selected=false where poll_id=pid and participant_id=person and option_id=ids[2];
  set constraints all immediate; set constraints all deferred;
  assert public.get_poll_participation(pid,person)->'option_ids'=to_jsonb(array[ids[1],ids[3]]);
  before_state:=public.get_poll_participation(pid,person);
  caught:=false;
  begin
    insert into public.poll_choice_selections(poll_id,participant_id,option_id,is_selected) values(pid,person,ids[4],true);
    set constraints all immediate;
  exception when check_violation then caught:=true; end;
  assert caught,'Direct write bypassed maximum';
  assert before_state=public.get_poll_participation(pid,person),'Constraint rollback lost old selections';
  -- Mid-replacement failure must roll back deselections and inserts together.
  perform set_config('project203.qa_fail_option',ids[5]::text,true);
  caught:=false;
  begin perform public.submit_choice_ballot(pid,array[ids[2],ids[5]],person);
  exception when check_violation then caught:=true; end;
  assert caught and before_state=public.get_poll_participation(pid,person),'Partial ballot after failure';
  perform set_config('project203.qa_fail_option','',true);
  update public.poll_choice_selections set is_selected=false where poll_id=pid;
  caught:=false;
  begin update public.polls set max_choices_per_participant=3 where id=pid;
  exception when sqlstate 'P2035' then caught:=true; end;
  assert caught,'Inactive history did not lock setting';
  update public.polls set is_hidden=true where id=pid;
  assert public.submit_choice_ballot(pid,array[ids[1]],person)->>'status'='poll_not_found';
  update public.polls set is_hidden=false,is_closed=true where id=pid;
  assert public.submit_choice_ballot(pid,array[ids[1]],person)->>'status'='poll_closed';
  set constraints all immediate;
  assert not has_function_privilege('anon','public.submit_choice_ballot(bigint,bigint[],uuid)','EXECUTE');
  assert not has_any_column_privilege('authenticated','public.polls','UPDATE');
end $$;

-- Every row present before this test is unchanged, including original responses.
do $$ begin
  assert not exists(select 1 from qa_limit_originals q left join (
    select 'polls' as kind,id::text as key,to_jsonb(p) as data from public.polls p
    union all select 'options',id::text,to_jsonb(o) from public.poll_options o
    union all select 'votes',id::text,to_jsonb(v) from public.votes v
    union all select 'selections',poll_id||'/'||participant_id||'/'||option_id,to_jsonb(s) from public.poll_choice_selections s
    union all select 'people',id::text,to_jsonb(p) from public.participants p
  ) current_rows using(kind,key) where q.data is distinct from current_rows.data),'Original records changed';
end $$;
select true as isolated_choice_limit_checks_passed;
rollback;
