-- Run manually in a TEST database after the migrations. All fixture rows roll back.
-- Production migrations are never applied by the app or this repository's test commands.
begin;
do $$
declare
  person uuid := gen_random_uuid();
  single_slug text; repeat_slug text; upcoming_slug text;
  single_id bigint; repeat_id bigint; upcoming_id bigint;
  option_a bigint; option_b bigint; repeat_option bigint; upcoming_option bigint;
  before_count bigint; result jsonb; input jsonb;
begin
  if has_function_privilege('anon', 'public.admin_create_poll(jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.admin_update_poll(bigint,jsonb)', 'EXECUTE')
    or has_function_privilege('anon', 'public.get_poll_catalog(text,boolean)', 'EXECUTE')
    or has_function_privilege('anon', 'public.submit_vote(bigint,bigint,uuid)', 'EXECUTE') then
    raise exception 'Browser roles retain private RPC access';
  end if;
  if not has_function_privilege('service_role', 'public.admin_create_poll(jsonb)', 'EXECUTE') then raise exception 'Missing service grant'; end if;
  insert into public.participants(id, display_name) values (person, 'QA-' || person::text);
  input := jsonb_build_object('quarter','2026-q4','title','QA single','description','','vote_mode','single','allow_vote_change',false,'is_hidden',false,
    'poll_type','choice','results_visibility','live','text_max_length',1000,
    'voting_starts_at',null,'voting_ends_at',null,'options',jsonb_build_array('A','B'));
  select count(*) into before_count from public.polls;
  begin
    perform public.admin_create_poll(input - 'quarter');
    raise exception 'Missing quarter accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.admin_create_poll(input || '{"quarter":"abc"}'::jsonb);
    raise exception 'Invalid quarter format accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.admin_create_poll(input || '{"options":["only one"]}'::jsonb);
    raise exception 'Invalid options accepted';
  exception when invalid_parameter_value then null;
  end;
  if (select count(*) from public.polls) <> before_count then raise exception 'Partial poll created'; end if;
  single_slug := public.admin_create_poll(input)->>'slug';
  select id into single_id from public.polls where slug=single_slug;
  select min(id),max(id) into option_a,option_b from public.poll_options where poll_id=single_id;
  -- Zero-vote polls can move; the DB validates format, the Next.js server validates registration.
  perform public.admin_update_poll(single_id, input || '{"quarter":"2027-q1"}'::jsonb);
  perform public.admin_update_poll(single_id, input);
  if public.submit_vote(single_id,option_a,person)->>'status' <> 'success' then raise exception 'First vote failed'; end if;
  begin
    perform public.admin_update_poll(single_id, input || '{"quarter":"2027-q1"}'::jsonb);
    raise exception 'Voted poll moved to another quarter';
  exception when sqlstate 'P2031' then null;
  end;
  if (select quarter from public.polls where id=single_id) <> '2026-q4' then raise exception 'Quarter changed after voting'; end if;
  if public.submit_vote(single_id,option_b,person)->>'status' <> 'already_voted' then raise exception 'Single duplicate accepted'; end if;
  perform public.admin_update_poll(single_id, input || '{"title":"QA edited","allow_vote_change":true}'::jsonb);
  if public.submit_vote(single_id,option_b,person)->>'status' <> 'vote_changed' then raise exception 'Change failed'; end if;
  if (select count(*) from public.votes where poll_id=single_id) <> 1
    or (select option_id from public.votes where poll_id=single_id) <> option_b then raise exception 'Vote change inserted another row'; end if;
  perform public.admin_set_poll_state(single_id,'close');
  if public.submit_vote(single_id,option_a,person)->>'status' <> 'poll_closed' then raise exception 'Closed vote accepted'; end if;
  perform public.admin_set_poll_state(single_id,'reopen');
  if public.submit_vote(single_id,option_a,person)->>'status' <> 'vote_changed' then raise exception 'Reopen failed'; end if;
  perform public.admin_set_poll_state(single_id,'hide');
  if jsonb_array_length(public.get_poll_catalog(single_slug,false)) <> 0 then raise exception 'Hidden poll leaked'; end if;
  if public.submit_vote(single_id,option_b,person)->>'status' <> 'poll_not_found' then raise exception 'Hidden vote accepted'; end if;
  perform public.admin_set_poll_state(single_id,'unhide');
  if jsonb_array_length(public.get_poll_catalog(single_slug,false)) <> 1 then raise exception 'Unhide failed'; end if;
  repeat_slug := public.admin_create_poll(input || '{"title":"QA repeat","vote_mode":"multiple"}'::jsonb)->>'slug';
  select id into repeat_id from public.polls where slug=repeat_slug;
  select min(id) into repeat_option from public.poll_options where poll_id=repeat_id;
  perform public.submit_vote(repeat_id,repeat_option,person);
  perform public.submit_vote(repeat_id,repeat_option,person);
  result := public.get_poll_results(repeat_id);
  if (result->>'total_votes')::integer <> 2 or (result->>'participant_count')::integer <> 1 then raise exception 'Repeat totals incorrect'; end if;
  upcoming_slug := public.admin_create_poll(input || jsonb_build_object('title','QA upcoming',
    'voting_starts_at',clock_timestamp()+interval '1 day','voting_ends_at',clock_timestamp()+interval '2 days'))->>'slug';
  select id into upcoming_id from public.polls where slug=upcoming_slug;
  select min(id) into upcoming_option from public.poll_options where poll_id=upcoming_id;
  if public.submit_vote(upcoming_id,upcoming_option,person)->>'status' <> 'poll_upcoming' then raise exception 'Upcoming vote accepted'; end if;
  perform public.admin_update_poll(upcoming_id, input || jsonb_build_object('voting_starts_at',clock_timestamp()-interval '2 days','voting_ends_at',clock_timestamp()-interval '1 day'));
  perform public.admin_set_poll_state(upcoming_id,'reopen');
  if public.submit_vote(upcoming_id,upcoming_option,person)->>'status' <> 'poll_closed' then raise exception 'Expired reopen accepted a vote'; end if;
end $$;
rollback;
