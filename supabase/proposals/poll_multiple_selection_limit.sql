-- UNAPPLIED additive migration proposal, based on production pg_get_functiondef 2026-11-20.
-- Register with 'supabase migration new poll_multiple_selection_limit' when CLI is available.
-- TEST first; production requires separate approval. Do not replay earlier migrations.
-- No rows/backfills/deletes or changes to result policies, RLS, images or member identities.
begin;
alter table public.polls add column max_choices_per_participant smallint;
alter table public.polls add constraint polls_max_choices_per_participant_check check (
  max_choices_per_participant is null or (poll_type='choice' and vote_mode='multiple' and max_choices_per_participant between 2 and 5)
);
CREATE OR REPLACE FUNCTION public.validate_poll_input(p_data jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare start_at timestamptz; end_at timestamptz;
begin
  if jsonb_typeof(p_data->'quarter') is distinct from 'string' or coalesce(p_data->>'quarter','') !~ '^[0-9]{4}-q[1-4]$'
    or jsonb_typeof(p_data->'title') is distinct from 'string' or char_length(btrim(p_data->>'title')) not between 1 and 160
    or jsonb_typeof(p_data->'description') is distinct from 'string' or char_length(p_data->>'description')>2000
    or coalesce(p_data->>'poll_type','') not in ('choice','text')
    or coalesce(p_data->>'results_visibility','') not in ('live','after_close')
    or jsonb_typeof(p_data->'text_max_length') is distinct from 'number'
    or (p_data->>'text_max_length') !~ '^[0-9]+$' or (p_data->>'text_max_length')::numeric not between 10 and 5000
    or coalesce(p_data->>'vote_mode','') not in ('single','multiple')
    or (p_data->>'poll_type'='text' and p_data->>'vote_mode'<>'single')
    or jsonb_typeof(p_data->'allow_vote_change') is distinct from 'boolean'
    or jsonb_typeof(p_data->'is_hidden') is distinct from 'boolean' then
    raise exception using errcode='22023',message='Invalid poll settings';
  end if;
  if p_data ? 'max_choices_per_participant' and p_data->'max_choices_per_participant'<>'null'::jsonb then
    if jsonb_typeof(p_data->'max_choices_per_participant') is distinct from 'number'
      or (p_data->>'max_choices_per_participant') !~ '^[2-5]$'
      or p_data->>'poll_type'<>'choice' or p_data->>'vote_mode'<>'multiple' then
      raise exception using errcode='22023',message='Invalid maximum choice count';
    end if;
  end if;
  start_at:=(p_data->>'voting_starts_at')::timestamptz;
  end_at:=(p_data->>'voting_ends_at')::timestamptz;
  if (start_at is null)<>(end_at is null) or end_at<=start_at then raise exception using errcode='22023',message='Invalid voting period'; end if;
  if jsonb_typeof(p_data->'options') is distinct from 'array' then raise exception using errcode='22023',message='Options must be an array'; end if;
  if p_data->>'max_choices_per_participant' is not null and jsonb_array_length(p_data->'options')>0
    and (p_data->>'max_choices_per_participant')::smallint>jsonb_array_length(p_data->'options') then
    raise exception using errcode='22023',message='Maximum choice count exceeds option count';
  end if;
end $function$;
CREATE OR REPLACE FUNCTION public.admin_create_poll(p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare new_id bigint; new_slug text:='poll-'||gen_random_uuid()::text;
begin
  perform public.validate_poll_input(p_data);
  if p_data->>'poll_type'='choice' and (jsonb_array_length(p_data->'options') not between 2 and 20 or exists(
    select 1 from jsonb_array_elements(p_data->'options') o where jsonb_typeof(o)<>'string' or char_length(btrim(o #>> '{}')) not between 1 and 100
  )) then raise exception using errcode='22023',message='Invalid options'; end if;
  insert into public.polls(slug,quarter,title,description,poll_type,results_visibility,text_max_length,vote_mode,allow_repeat_vote,allow_vote_change,voting_starts_at,voting_ends_at,is_hidden,max_choices_per_participant)
  values(new_slug,p_data->>'quarter',btrim(p_data->>'title'),btrim(p_data->>'description'),p_data->>'poll_type',p_data->>'results_visibility',(p_data->>'text_max_length')::integer,
    p_data->>'vote_mode',p_data->>'vote_mode'='multiple',(p_data->>'allow_vote_change')::boolean,
    (p_data->>'voting_starts_at')::timestamptz,(p_data->>'voting_ends_at')::timestamptz,(p_data->>'is_hidden')::boolean,(p_data->>'max_choices_per_participant')::smallint) returning id into new_id;
  if p_data->>'poll_type'='choice' then
    insert into public.poll_options(poll_id,label,display_order)
    select new_id,btrim(label),ordering::integer from jsonb_array_elements_text(p_data->'options') with ordinality as choices(label,ordering);
  end if;
  return jsonb_build_object('slug',new_slug);
end $function$;
CREATE OR REPLACE FUNCTION public.admin_update_poll(p_poll_id bigint, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare target public.polls%rowtype; has_votes boolean; existing_options jsonb; next_limit smallint;
begin
  perform public.validate_poll_input(p_data);
  select * into target from public.polls where id=p_poll_id for update;
  if not found then raise exception using errcode='22023',message='Poll not found'; end if;
  select exists(select 1 from public.votes where poll_id=p_poll_id)
    or exists(select 1 from public.poll_choice_selections where poll_id=p_poll_id) into has_votes;
  next_limit:=case when p_data ? 'max_choices_per_participant' then (p_data->>'max_choices_per_participant')::smallint else target.max_choices_per_participant end;
  if has_votes and next_limit is distinct from target.max_choices_per_participant then
    raise exception using errcode='P2035',message='Maximum choice count locked after responding';
  end if;
  if has_votes and target.quarter is distinct from p_data->>'quarter' then raise exception using errcode='P2031',message='Quarter locked'; end if;
  if has_votes and (target.poll_type is distinct from p_data->>'poll_type' or target.vote_mode is distinct from p_data->>'vote_mode') then
    raise exception using errcode='P2032',message='Poll type locked';
  end if;
  select coalesce(jsonb_agg(label order by display_order,id),'[]'::jsonb) into existing_options from public.poll_options where poll_id=p_poll_id;
  if has_votes and jsonb_array_length(p_data->'options')>0 and existing_options<>p_data->'options' then raise exception using errcode='P2032',message='Voted options locked'; end if;
  if not has_votes and p_data->>'poll_type'='choice' and (jsonb_array_length(p_data->'options') not between 2 and 20 or exists(
    select 1 from jsonb_array_elements(p_data->'options') o where jsonb_typeof(o)<>'string' or char_length(btrim(o #>> '{}')) not between 1 and 100
  )) then raise exception using errcode='22023',message='Invalid options'; end if;
  update public.polls set quarter=p_data->>'quarter',title=btrim(p_data->>'title'),description=btrim(p_data->>'description'),
    poll_type=p_data->>'poll_type',results_visibility=p_data->>'results_visibility',text_max_length=(p_data->>'text_max_length')::integer,
    max_choices_per_participant=next_limit,vote_mode=p_data->>'vote_mode',allow_vote_change=(p_data->>'allow_vote_change')::boolean,
    voting_starts_at=(p_data->>'voting_starts_at')::timestamptz,voting_ends_at=(p_data->>'voting_ends_at')::timestamptz,is_hidden=(p_data->>'is_hidden')::boolean where id=p_poll_id;
  if not has_votes and (target.poll_type is distinct from p_data->>'poll_type' or (p_data->>'poll_type'='choice' and existing_options<>p_data->'options')) then
    delete from public.poll_options where poll_id=p_poll_id;
    if p_data->>'poll_type'='choice' then
      insert into public.poll_options(poll_id,label,display_order)
      select p_poll_id,btrim(label),ordering::integer from jsonb_array_elements_text(p_data->'options') with ordinality as choices(label,ordering);
    end if;
  end if;
  return jsonb_build_object('slug',target.slug);
end $function$;
CREATE OR REPLACE FUNCTION public.get_poll_detail(p_slug text, p_admin boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select summary || case when p_admin then jsonb_build_object('has_responses',
    exists(select 1 from public.votes where poll_id=(summary->'poll'->>'id')::bigint)
    or exists(select 1 from public.poll_choice_selections where poll_id=(summary->'poll'->>'id')::bigint))
    else '{}'::jsonb end || jsonb_build_object(
    'options',case when summary->'poll'->>'poll_type'='choice' then
      coalesce((select jsonb_agg(to_jsonb(o) order by display_order,id) from public.poll_options o where poll_id=(summary->'poll'->>'id')::bigint),'[]'::jsonb)
      else '[]'::jsonb end,
    'responses',case when summary->'poll'->>'poll_type'='text' and summary->'results'<>'null'::jsonb then
      coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'participant_id',v.participant_id,'participant_name',p.display_name,
        'text_response',v.text_response,'created_at',v.created_at,'updated_at',v.updated_at) order by v.created_at,v.id)
        from public.votes v join public.participants p on p.id=v.participant_id
        where v.poll_id=(summary->'poll'->>'id')::bigint),'[]'::jsonb)
      else null end
  ) from jsonb_array_elements(public.get_poll_catalog(p_slug,p_admin)) as entries(summary) limit 1;
$function$;
CREATE OR REPLACE FUNCTION public.submit_choice_ballot(p_poll_id bigint, p_option_ids bigint[], p_participant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare target public.polls%rowtype; selected_ids bigint[]; previous_ids bigint[]; previous_exists boolean; checked_at timestamptz;
begin
  select * into target from public.polls where id=p_poll_id for update;
  if not found or target.is_hidden then return jsonb_build_object('status','poll_not_found'); end if;
  if target.poll_type<>'choice' then return jsonb_build_object('status','invalid_poll_type'); end if;
  perform 1 from public.participants where id=p_participant_id and is_active for share;
  if not found then return jsonb_build_object('status','inactive_participant'); end if;
  checked_at:=clock_timestamp();
  if target.is_closed or (target.voting_ends_at is not null and checked_at>=target.voting_ends_at) then return jsonb_build_object('status','poll_closed'); end if;
  if target.voting_starts_at is not null and checked_at<target.voting_starts_at then return jsonb_build_object('status','poll_upcoming'); end if;
  if p_option_ids is null or coalesce(array_ndims(p_option_ids),0)<>1 or cardinality(p_option_ids)=0 or array_position(p_option_ids,null) is not null then
    return jsonb_build_object('status','invalid_selection');
  end if;
  select array_agg(distinct id order by id) into selected_ids from unnest(p_option_ids) ids(id);
  if cardinality(selected_ids)>20 or (target.vote_mode='single' and cardinality(selected_ids)<>1) then return jsonb_build_object('status','invalid_selection'); end if;
  if target.vote_mode='multiple' and target.max_choices_per_participant is not null
    and cardinality(selected_ids)>target.max_choices_per_participant then
    return jsonb_build_object('status','selection_limit_exceeded');
  end if;
  if exists(select 1 from unnest(selected_ids) ids(id) where not exists(select 1 from public.poll_options o where o.poll_id=p_poll_id and o.id=ids.id)) then
    return jsonb_build_object('status','invalid_option');
  end if;
  select coalesce(array_agg(option_id order by option_id) filter(where is_selected),'{}'::bigint[]),count(*)>0
    into previous_ids,previous_exists from public.poll_choice_selections where poll_id=p_poll_id and participant_id=p_participant_id;
  if previous_exists and not target.allow_vote_change then return jsonb_build_object('status','already_voted'); end if;
  if previous_exists and previous_ids=selected_ids then return jsonb_build_object('status','unchanged'); end if;
  -- Parent-row locking serializes double-clicks, simultaneous replacements and
  -- Admin close/edit. Any failure rolls back the complete set, including updates.
  update public.poll_choice_selections set is_selected=false
    where poll_id=p_poll_id and participant_id=p_participant_id and is_selected;
  insert into public.poll_choice_selections(poll_id,participant_id,option_id,is_selected)
    select p_poll_id,p_participant_id,id,true from unnest(selected_ids) ids(id)
    on conflict(poll_id,participant_id,option_id) do update set is_selected=true;
  return jsonb_build_object('status',case when previous_exists then 'vote_changed' else 'success' end);
end $function$;
CREATE OR REPLACE FUNCTION public.guard_poll_choice_selection()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare target public.polls%rowtype;
begin
  -- REPEATABLE READ cannot refresh a snapshot after waiting for a parent lock.
  -- Reject this non-default isolation level rather than allow write skew.
  if current_setting('transaction_isolation')='repeatable read' then
    raise exception using errcode='40001',message='Choice writes require READ COMMITTED or SERIALIZABLE';
  end if;
  select * into target from public.polls where id=new.poll_id for update;
  if not found or target.poll_type<>'choice' then raise exception using errcode='22023',message='Invalid choice poll'; end if;
  if tg_op='UPDATE' and (new.poll_id is distinct from old.poll_id or new.participant_id is distinct from old.participant_id or new.option_id is distinct from old.option_id) then
    raise exception using errcode='22023',message='Selection identity is immutable';
  end if;
  if new.is_selected and target.vote_mode='single' and exists(
    select 1 from public.poll_choice_selections where poll_id=new.poll_id
      and participant_id=new.participant_id and is_selected and option_id<>new.option_id
  ) then raise exception using errcode='22023',message='Single ballot permits exactly one selected option'; end if;
  new.updated_at:=clock_timestamp();
  return new;
end $function$;

-- A change after ANY history (including inactive selections) would reinterpret
-- past ballots. Lock the setting in both RPC and direct server-role UPDATEs.
create function public.guard_poll_choice_limit_setting() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.max_choices_per_participant is distinct from old.max_choices_per_participant then
    if current_setting('transaction_isolation')='repeatable read' then
      raise exception using errcode='40001',message='Choice configuration requires READ COMMITTED or SERIALIZABLE';
    end if;
    if exists(select 1 from public.votes where poll_id=old.id)
      or exists(select 1 from public.poll_choice_selections where poll_id=old.id) then
      raise exception using errcode='P2035',message='Maximum choice count locked after responding';
    end if;
  end if;
  return new;
end $$;
create trigger polls_choice_limit_setting before update on public.polls
for each row execute function public.guard_poll_choice_limit_setting();

-- Existing guard_poll_choice_selection locks the same parent before each write.
-- Check at transaction end: inserting C and then deselecting B is a legal A,C
-- replacement even if the intermediate A,B,C state exceeds a cap of 2.
create function public.check_poll_choice_limit_count() returns trigger
language plpgsql security invoker set search_path='' as $$
declare maximum smallint;
begin
  select max_choices_per_participant into maximum from public.polls where id=new.poll_id for update;
  if maximum is not null and (select count(*) from public.poll_choice_selections
    where poll_id=new.poll_id and participant_id=new.participant_id and is_selected)>maximum then
    raise exception using errcode='23514',message='Maximum choice count exceeded',constraint='choice_selection_maximum';
  end if;
  return null;
end $$;
create constraint trigger choice_selection_maximum after insert or update on public.poll_choice_selections
deferrable initially deferred for each row execute function public.check_poll_choice_limit_count();

-- Option edits and setting edits must share the ballot's parent lock as well.
create function public.lock_poll_choice_limit_options() returns trigger
language plpgsql security invoker set search_path='' as $$
declare target_id bigint;
begin
  if current_setting('transaction_isolation')='repeatable read' then
    raise exception using errcode='40001',message='Choice options require READ COMMITTED or SERIALIZABLE';
  end if;
  target_id:=case when tg_op='DELETE' then old.poll_id else new.poll_id end;
  if tg_op='UPDATE' and old.poll_id is distinct from new.poll_id then
    raise exception using errcode='22023',message='Option poll identity is immutable';
  end if;
  perform 1 from public.polls where id=target_id for update;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger poll_options_choice_limit_lock before insert or update or delete on public.poll_options
for each row execute function public.lock_poll_choice_limit_options();

-- A deferred check lets admin_create_poll insert its poll before its options and
-- lets an unvoted poll replace its options within one transaction.
create function public.check_poll_choice_limit_options() returns trigger
language plpgsql security invoker set search_path='' as $$
declare target_id bigint; maximum smallint;
begin
  if tg_table_name='polls' then target_id:=new.id;
  elsif tg_op='DELETE' then target_id:=old.poll_id;
  else target_id:=new.poll_id; end if;
  select max_choices_per_participant into maximum from public.polls where id=target_id for update;
  if maximum is not null and maximum>(select count(*) from public.poll_options where poll_id=target_id) then
    raise exception using errcode='23514',message='Maximum choice count exceeds option count',constraint='poll_choice_limit_option_count';
  end if;
  return null;
end $$;
create constraint trigger poll_choice_limit_option_count after insert or update on public.polls
deferrable initially deferred for each row execute function public.check_poll_choice_limit_options();
create constraint trigger poll_options_choice_limit_count after insert or update or delete on public.poll_options
deferrable initially deferred for each row execute function public.check_poll_choice_limit_options();

revoke all on function public.validate_poll_input(jsonb) from public,anon,authenticated;
grant execute on function public.validate_poll_input(jsonb) to service_role;
revoke all on function public.admin_create_poll(jsonb) from public,anon,authenticated;
grant execute on function public.admin_create_poll(jsonb) to service_role;
revoke all on function public.admin_update_poll(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.admin_update_poll(bigint,jsonb) to service_role;
revoke all on function public.get_poll_detail(text,boolean) from public,anon,authenticated;
grant execute on function public.get_poll_detail(text,boolean) to service_role;
revoke all on function public.submit_choice_ballot(bigint,bigint[],uuid) from public,anon,authenticated;
grant execute on function public.submit_choice_ballot(bigint,bigint[],uuid) to service_role;
revoke all on function public.guard_poll_choice_selection() from public,anon,authenticated;
grant execute on function public.guard_poll_choice_selection() to service_role;
revoke all on function public.guard_poll_choice_limit_setting() from public,anon,authenticated;
grant execute on function public.guard_poll_choice_limit_setting() to service_role;
revoke all on function public.check_poll_choice_limit_count() from public,anon,authenticated;
grant execute on function public.check_poll_choice_limit_count() to service_role;
revoke all on function public.check_poll_choice_limit_options() from public,anon,authenticated;
grant execute on function public.check_poll_choice_limit_options() to service_role;
revoke all on function public.lock_poll_choice_limit_options() from public,anon,authenticated;
grant execute on function public.lock_poll_choice_limit_options() to service_role;
notify pgrst, 'reload schema';
commit;
