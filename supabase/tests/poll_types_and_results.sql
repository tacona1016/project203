-- TEST DB only, after the new migration. All fixture rows/changes roll back.
begin;
do $$
declare person uuid:=gen_random_uuid(); other_person uuid:=gen_random_uuid();
  input jsonb; text_slug text; choice_slug text; draft_slug text; text_id bigint; choice_id bigint; draft_id bigint; choice_option bigint; outcome jsonb;
begin
  if has_function_privilege('anon','public.get_poll_detail(text,boolean)','EXECUTE')
    or has_function_privilege('authenticated','public.submit_text_response(bigint,uuid,text)','EXECUTE') then raise exception 'Browser RPC permission leaked'; end if;
  insert into public.participants(id,display_name) values(person,'QA-text-'||person::text),(other_person,'QA-text-'||other_person::text);
  input:=jsonb_build_object('quarter','2026-q4','title','QA text','description','','poll_type','text','results_visibility','after_close',
    'text_max_length',1000,'vote_mode','single','allow_vote_change',false,'is_hidden',false,'voting_starts_at',null,'voting_ends_at',null,'options','[]'::jsonb);
  text_slug:=public.admin_create_poll(input)->>'slug';
  select id into text_id from public.polls where slug=text_slug;
  if exists(select 1 from public.poll_options where poll_id=text_id) then raise exception 'Text poll has options'; end if;
  if public.submit_text_response(text_id,person,'first response')->>'status'<>'success' then raise exception 'First response failed'; end if;
  if public.submit_text_response(text_id,person,'second response')->>'status'<>'already_voted' then raise exception 'Duplicate response accepted'; end if;
  if public.submit_text_response(text_id,other_person,'  ')->>'status'<>'invalid_response' then raise exception 'Empty response accepted'; end if;
  if public.submit_text_response(text_id,other_person,repeat('x',1001))->>'status'<>'response_too_long' then raise exception 'Long response accepted'; end if;
  outcome:=public.get_poll_detail(text_slug,false);
  if outcome->'results'<>'null'::jsonb or outcome->'responses'<>'null'::jsonb then raise exception 'Unpublished outcomes leaked'; end if;
  if jsonb_array_length(public.get_poll_detail(text_slug,true)->'responses')<>1 then raise exception 'Admin cannot read unpublished text'; end if;
  perform public.admin_update_poll(text_id,input||'{"allow_vote_change":true}'::jsonb);
  if public.submit_text_response(text_id,person,'v')->>'status'<>'vote_changed' then raise exception 'Ordinary letter trimmed as whitespace'; end if;
  if (select text_response from public.votes where poll_id=text_id and participant_id=person)<>'v' then raise exception 'Trailing letter lost during trim'; end if;
  if public.submit_text_response(text_id,person,'updated response')->>'status'<>'vote_changed' then raise exception 'Edit failed'; end if;
  if (select count(*) from public.votes where poll_id=text_id)<>1 then raise exception 'Edit inserted another response'; end if;
  begin
    perform public.admin_update_poll(text_id,input||'{"text_max_length":10}'::jsonb);
    raise exception 'Shrinking below existing response accepted';
  exception when sqlstate 'P2033' then null;
  end;
  begin
    perform public.admin_update_poll(text_id,input||'{"poll_type":"choice"}'::jsonb);
    raise exception 'Responded poll type changed';
  exception when sqlstate 'P2032' then null;
  end;
  perform public.admin_set_poll_state(text_id,'close');
  if jsonb_array_length(public.get_poll_detail(text_slug,false)->'responses')<>1 then raise exception 'Manual close did not publish'; end if;
  perform public.admin_set_poll_state(text_id,'reopen');
  if public.get_poll_detail(text_slug,false)->'results'<>'null'::jsonb then raise exception 'Reopen leaked outcomes'; end if;
  perform public.admin_update_poll(text_id,input||'{"results_visibility":"live"}'::jsonb);
  if jsonb_array_length(public.get_poll_detail(text_slug,false)->'responses')<>1 then raise exception 'Live text unavailable'; end if;
  perform public.admin_update_poll(text_id,input||jsonb_build_object('voting_starts_at',clock_timestamp()-interval '2 days','voting_ends_at',clock_timestamp()-interval '1 day'));
  if jsonb_array_length(public.get_poll_detail(text_slug,false)->'responses')<>1 then raise exception 'Timed close did not publish'; end if;
  if public.submit_text_response(text_id,other_person,'late')->>'status'<>'poll_closed' then raise exception 'Expired response accepted'; end if;
  choice_slug:=public.admin_create_poll(input||'{"title":"QA choice","poll_type":"choice","options":["A","B"]}'::jsonb)->>'slug';
  select id into choice_id from public.polls where slug=choice_slug;
  select min(id) into choice_option from public.poll_options where poll_id=choice_id;
  perform public.submit_vote(choice_id,choice_option,person);
  if public.get_poll_detail(choice_slug,false)->'results'<>'null'::jsonb then raise exception 'Choice counts leaked'; end if;
  perform public.admin_set_poll_state(choice_id,'close');
  if (public.get_poll_detail(choice_slug,false)->'results'->>'total_votes')::integer<>1 then raise exception 'Choice counts not published'; end if;
  draft_slug:=public.admin_create_poll(input)->>'slug';
  select id into draft_id from public.polls where slug=draft_slug;
  perform public.admin_update_poll(draft_id,input||'{"poll_type":"choice","options":["A","B"]}'::jsonb);
  if (select count(*) from public.poll_options where poll_id=draft_id)<>2 then raise exception 'Zero-response conversion failed'; end if;
  perform public.admin_update_poll(draft_id,input);
  if exists(select 1 from public.poll_options where poll_id=draft_id) then raise exception 'Text conversion retained active options'; end if;
end $$;
-- Check the invoker functions with the actual server role, including column grants.
do $$
declare person uuid:=gen_random_uuid(); target_slug text; poll_id bigint;
begin
  insert into public.participants(id,display_name) values(person,'QA-service-'||person::text);
  target_slug:=public.admin_create_poll('{"quarter":"2026-q4","title":"QA service insert","description":"","poll_type":"text","results_visibility":"live","text_max_length":1000,"vote_mode":"single","allow_vote_change":true,"is_hidden":false,"voting_starts_at":null,"voting_ends_at":null,"options":[]}'::jsonb)->>'slug';
  select id into poll_id from public.polls where public.polls.slug=target_slug;
  perform set_config('project203.qa_text_poll',poll_id::text,true);
  perform set_config('project203.qa_text_person',person::text,true);
end $$;
set local role service_role;
do $$
begin
  if public.submit_text_response(current_setting('project203.qa_text_poll')::bigint,current_setting('project203.qa_text_person')::uuid,'server role insert')->>'status'<>'success' then raise exception 'Service role insert failed'; end if;
  if public.submit_text_response(current_setting('project203.qa_text_poll')::bigint,current_setting('project203.qa_text_person')::uuid,'server role update')->>'status'<>'vote_changed' then raise exception 'Service role update failed'; end if;
end $$;
reset role;
rollback;
