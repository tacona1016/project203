-- Review and run AFTER 20261023020000_poll_quarters.sql.
-- Preserves all polls/votes/participants/comments and all voted option IDs.
begin;

do $$
begin
  if to_regprocedure('public.guard_poll_quarter()') is null
    or has_table_privilege('anon', 'public.polls', 'SELECT')
    or not exists (select 1 from pg_policies where schemaname='public' and tablename='polls' and policyname='private_site_server_only') then
    raise exception 'Apply the private-site, poll-management and quarter migrations first.';
  end if;
end $$;

alter table public.polls add column if not exists poll_type text not null default 'choice';
alter table public.polls add column if not exists results_visibility text not null default 'live';
alter table public.polls add column if not exists text_max_length integer not null default 1000;
alter table public.votes add column if not exists text_response text;
alter table public.votes add column if not exists updated_at timestamptz;
update public.votes set updated_at=coalesce(created_at, now()) where updated_at is null;
alter table public.votes alter column updated_at set default now();
alter table public.votes alter column updated_at set not null;
alter table public.votes alter column option_id drop not null;

do $$
begin
  if not exists(select 1 from pg_constraint where conrelid='public.polls'::regclass and conname='polls_type_valid') then
    alter table public.polls add constraint polls_type_valid check(poll_type in ('choice','text'));
    alter table public.polls add constraint polls_results_visibility_valid check(results_visibility in ('live','after_close'));
    alter table public.polls add constraint polls_text_length_valid check(text_max_length between 10 and 5000);
    alter table public.polls add constraint polls_text_single check(poll_type <> 'text' or (vote_mode='single' and not allow_repeat_vote));
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.votes'::regclass and conname='votes_response_shape') then
    alter table public.votes add constraint votes_response_shape check(
      (option_id is not null and text_response is null) or
      (option_id is null and text_response is not null
        and char_length(text_response) between 1 and 5000
        and text_response=btrim(text_response, E' \t\n\r\f\013') and text_response ~ '[^[:space:]]')
    );
  end if;
end $$;

-- Text only: never apply a global UNIQUE that would break multiple choice votes.
create unique index if not exists votes_text_participant_key on public.votes(poll_id, participant_id) where text_response is not null;

create or replace function public.sync_poll_settings() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.poll_type='text' then
    new.vote_mode:='single';
  elsif tg_op='UPDATE' then
    if new.vote_mode=old.vote_mode and new.allow_repeat_vote is distinct from old.allow_repeat_vote then
      new.vote_mode:=case when new.allow_repeat_vote then 'multiple' else 'single' end;
    end if;
  end if;
  new.allow_repeat_vote:=new.vote_mode='multiple';
  if new.vote_mode='multiple' then new.allow_vote_change:=false; end if;
  new.updated_at:=clock_timestamp();
  return new;
end $$;

create or replace function public.guard_poll_content() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if (new.poll_type is distinct from old.poll_type or new.vote_mode is distinct from old.vote_mode)
    and exists(select 1 from public.votes where poll_id=old.id) then
    raise exception using errcode='P2032', message='Poll type and vote mode are immutable after responding';
  end if;
  if new.text_max_length < old.text_max_length and exists(
    select 1 from public.votes where poll_id=old.id and char_length(text_response)>new.text_max_length
  ) then raise exception using errcode='P2033', message='Existing response exceeds new maximum'; end if;
  return new;
end $$;
create or replace trigger polls_guard_content before update on public.polls
for each row execute function public.guard_poll_content();

create or replace function public.guard_poll_vote() returns trigger
language plpgsql security invoker set search_path='' as $$
declare target public.polls%rowtype;
begin
  -- Same parent-row lock as Admin/submit functions, including direct server writes.
  select * into target from public.polls where id=new.poll_id for update;
  if not found then raise exception using errcode='22023', message='Poll not found'; end if;
  if target.poll_type='choice' then
    if new.option_id is null or new.text_response is not null or not exists(
      select 1 from public.poll_options where id=new.option_id and poll_id=new.poll_id
    ) then raise exception using errcode='22023', message='Invalid choice vote'; end if;
  else
    if new.option_id is not null or new.text_response is null then
      raise exception using errcode='22023', message='Invalid text response';
    end if;
    new.text_response:=btrim(new.text_response, E' \t\n\r\f\013');
    if char_length(new.text_response) not between 1 and target.text_max_length or new.text_response !~ '[^[:space:]]' then
      raise exception using errcode='22023', message='Invalid response length';
    end if;
  end if;
  new.updated_at:=case when tg_op='INSERT' then coalesce(new.created_at,clock_timestamp()) else clock_timestamp() end;
  return new;
end $$;
create or replace trigger votes_guard_response before insert or update on public.votes
for each row execute function public.guard_poll_vote();

create or replace function public.get_poll_results(p_poll_id bigint) returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'counts', coalesce((select jsonb_object_agg(option_id::text,vote_count) from (
      select option_id,count(*) as vote_count from public.votes where poll_id=p_poll_id and option_id is not null group by option_id
    ) counts),'{}'::jsonb),
    'total_votes',(select count(*) from public.votes where poll_id=p_poll_id),
    'participant_count',(select count(distinct participant_id) from public.votes where poll_id=p_poll_id)
  );
$$;

-- This flag is passed only by Next.js after Admin session validation; all RPCs
-- remain service-role only. The general endpoints never accept an admin flag.
create or replace function public.get_poll_catalog(p_slug text default null,p_include_hidden boolean default false)
returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(item order by created_at desc nulls last,id desc),'[]'::jsonb) from (
    select p.created_at,p.id,jsonb_build_object(
      'poll',to_jsonb(p),'server_time',statement_timestamp(),
      'status',case when p.is_hidden then 'HIDDEN'
        when p.is_closed or (p.voting_ends_at is not null and statement_timestamp()>=p.voting_ends_at) then 'CLOSED'
        when p.voting_starts_at is not null and statement_timestamp()<p.voting_starts_at then 'UPCOMING'
        else 'ACTIVE' end,
      'results',case when p_include_hidden or p.results_visibility='live' or p.is_closed
        or (p.voting_ends_at is not null and statement_timestamp()>=p.voting_ends_at)
        then public.get_poll_results(p.id) else null end
    ) item from public.polls p where (p_slug is null or p.slug=p_slug) and (p_include_hidden or not p.is_hidden)
  ) items;
$$;

-- One statement/snapshot prevents close/reopen races between checking policy
-- and fetching outcomes. Unpublished text is never part of the returned payload.
create or replace function public.get_poll_detail(p_slug text,p_admin boolean default false)
returns jsonb language sql stable security invoker set search_path='' as $$
  select summary || jsonb_build_object(
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
$$;

create or replace function public.submit_vote(p_poll_id bigint,p_option_id bigint,p_participant_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare target public.polls%rowtype; previous_id bigint; previous_option bigint; previous_count bigint; checked_at timestamptz;
begin
  select * into target from public.polls where id=p_poll_id for update;
  if not found or target.is_hidden then return jsonb_build_object('status','poll_not_found'); end if;
  if target.poll_type<>'choice' then return jsonb_build_object('status','invalid_poll_type'); end if;
  perform 1 from public.participants where id=p_participant_id and is_active for share;
  if not found then return jsonb_build_object('status','inactive_participant'); end if;
  checked_at:=clock_timestamp();
  if target.is_closed or (target.voting_ends_at is not null and checked_at>=target.voting_ends_at) then return jsonb_build_object('status','poll_closed'); end if;
  if target.voting_starts_at is not null and checked_at<target.voting_starts_at then return jsonb_build_object('status','poll_upcoming'); end if;
  if not exists(select 1 from public.poll_options where id=p_option_id and poll_id=p_poll_id) then return jsonb_build_object('status','invalid_option'); end if;
  if target.vote_mode='single' then
    select count(*) into previous_count from public.votes where poll_id=p_poll_id and participant_id=p_participant_id;
    if previous_count>0 then
      if not target.allow_vote_change then return jsonb_build_object('status','already_voted'); end if;
      if previous_count>1 then return jsonb_build_object('status','legacy_votes_conflict'); end if;
      select id,option_id into previous_id,previous_option from public.votes where poll_id=p_poll_id and participant_id=p_participant_id;
      if previous_option=p_option_id then return jsonb_build_object('status','unchanged'); end if;
      update public.votes set option_id=p_option_id where id=previous_id;
      return jsonb_build_object('status','vote_changed');
    end if;
  end if;
  insert into public.votes(poll_id,option_id,participant_id) values(p_poll_id,p_option_id,p_participant_id);
  return jsonb_build_object('status','success');
end $$;

create or replace function public.submit_text_response(p_poll_id bigint,p_participant_id uuid,p_text_response text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare target public.polls%rowtype; previous public.votes%rowtype; response text; checked_at timestamptz;
begin
  select * into target from public.polls where id=p_poll_id for update;
  if not found or target.is_hidden then return jsonb_build_object('status','poll_not_found'); end if;
  if target.poll_type<>'text' then return jsonb_build_object('status','invalid_poll_type'); end if;
  perform 1 from public.participants where id=p_participant_id and is_active for share;
  if not found then return jsonb_build_object('status','inactive_participant'); end if;
  checked_at:=clock_timestamp();
  if target.is_closed or (target.voting_ends_at is not null and checked_at>=target.voting_ends_at) then return jsonb_build_object('status','poll_closed'); end if;
  if target.voting_starts_at is not null and checked_at<target.voting_starts_at then return jsonb_build_object('status','poll_upcoming'); end if;
  response:=btrim(p_text_response,E' \t\n\r\f\013');
  if response is null or response !~ '[^[:space:]]' then return jsonb_build_object('status','invalid_response'); end if;
  if char_length(response)>target.text_max_length then return jsonb_build_object('status','response_too_long'); end if;
  select * into previous from public.votes where poll_id=p_poll_id and participant_id=p_participant_id;
  if found then
    if not target.allow_vote_change then return jsonb_build_object('status','already_voted'); end if;
    if previous.text_response=response then return jsonb_build_object('status','unchanged'); end if;
    update public.votes set text_response=response where id=previous.id;
    return jsonb_build_object('status','vote_changed');
  end if;
  insert into public.votes(poll_id,participant_id,text_response) values(p_poll_id,p_participant_id,response);
  return jsonb_build_object('status','success');
end $$;

create or replace function public.validate_poll_input(p_data jsonb) returns void
language plpgsql security invoker set search_path='' as $$
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
  start_at:=(p_data->>'voting_starts_at')::timestamptz;
  end_at:=(p_data->>'voting_ends_at')::timestamptz;
  if (start_at is null)<>(end_at is null) or end_at<=start_at then raise exception using errcode='22023',message='Invalid voting period'; end if;
  if jsonb_typeof(p_data->'options') is distinct from 'array' then raise exception using errcode='22023',message='Options must be an array'; end if;
end $$;

create or replace function public.admin_create_poll(p_data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare new_id bigint; new_slug text:='poll-'||gen_random_uuid()::text;
begin
  perform public.validate_poll_input(p_data);
  if p_data->>'poll_type'='choice' and (jsonb_array_length(p_data->'options') not between 2 and 20 or exists(
    select 1 from jsonb_array_elements(p_data->'options') o where jsonb_typeof(o)<>'string' or char_length(btrim(o #>> '{}')) not between 1 and 100
  )) then raise exception using errcode='22023',message='Invalid options'; end if;
  insert into public.polls(slug,quarter,title,description,poll_type,results_visibility,text_max_length,vote_mode,allow_repeat_vote,allow_vote_change,voting_starts_at,voting_ends_at,is_hidden)
  values(new_slug,p_data->>'quarter',btrim(p_data->>'title'),btrim(p_data->>'description'),p_data->>'poll_type',p_data->>'results_visibility',(p_data->>'text_max_length')::integer,
    p_data->>'vote_mode',p_data->>'vote_mode'='multiple',(p_data->>'allow_vote_change')::boolean,
    (p_data->>'voting_starts_at')::timestamptz,(p_data->>'voting_ends_at')::timestamptz,(p_data->>'is_hidden')::boolean) returning id into new_id;
  if p_data->>'poll_type'='choice' then
    insert into public.poll_options(poll_id,label,display_order)
    select new_id,btrim(label),ordering::integer from jsonb_array_elements_text(p_data->'options') with ordinality as choices(label,ordering);
  end if;
  return jsonb_build_object('slug',new_slug);
end $$;

create or replace function public.admin_update_poll(p_poll_id bigint,p_data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare target public.polls%rowtype; has_votes boolean; existing_options jsonb;
begin
  perform public.validate_poll_input(p_data);
  select * into target from public.polls where id=p_poll_id for update;
  if not found then raise exception using errcode='22023',message='Poll not found'; end if;
  select exists(select 1 from public.votes where poll_id=p_poll_id) into has_votes;
  if has_votes and target.quarter is distinct from p_data->>'quarter' then raise exception using errcode='P2031',message='Quarter locked'; end if;
  if has_votes and (target.poll_type is distinct from p_data->>'poll_type' or target.vote_mode is distinct from p_data->>'vote_mode') then
    raise exception using errcode='P2032',message='Poll type locked';
  end if;
  select coalesce(jsonb_agg(label order by display_order,id),'[]'::jsonb) into existing_options from public.poll_options where poll_id=p_poll_id;
  if has_votes and jsonb_array_length(p_data->'options')>0 and existing_options<>p_data->'options' then
    raise exception using errcode='P2032',message='Voted options locked';
  end if;
  if not has_votes and p_data->>'poll_type'='choice' and (jsonb_array_length(p_data->'options') not between 2 and 20 or exists(
    select 1 from jsonb_array_elements(p_data->'options') o where jsonb_typeof(o)<>'string' or char_length(btrim(o #>> '{}')) not between 1 and 100
  )) then raise exception using errcode='22023',message='Invalid options'; end if;
  update public.polls set quarter=p_data->>'quarter',title=btrim(p_data->>'title'),description=btrim(p_data->>'description'),
    poll_type=p_data->>'poll_type',results_visibility=p_data->>'results_visibility',text_max_length=(p_data->>'text_max_length')::integer,
    vote_mode=p_data->>'vote_mode',allow_vote_change=(p_data->>'allow_vote_change')::boolean,
    voting_starts_at=(p_data->>'voting_starts_at')::timestamptz,voting_ends_at=(p_data->>'voting_ends_at')::timestamptz,is_hidden=(p_data->>'is_hidden')::boolean where id=p_poll_id;
  if not has_votes and (target.poll_type is distinct from p_data->>'poll_type' or (p_data->>'poll_type'='choice' and existing_options<>p_data->'options')) then
    -- Only unvoted draft choices may be replaced, under the same lock as submits.
    -- No polls, votes, participants or comments are ever deleted.
    delete from public.poll_options where poll_id=p_poll_id;
    if p_data->>'poll_type'='choice' then
      insert into public.poll_options(poll_id,label,display_order)
      select p_poll_id,btrim(label),ordering::integer from jsonb_array_elements_text(p_data->'options') with ordinality as choices(label,ordering);
    end if;
  end if;
  return jsonb_build_object('slug',target.slug);
end $$;

revoke all on function public.guard_poll_content(),public.guard_poll_vote(),public.sync_poll_settings(),
  public.get_poll_results(bigint),public.get_poll_catalog(text,boolean),public.get_poll_detail(text,boolean),
  public.submit_vote(bigint,bigint,uuid),public.submit_text_response(bigint,uuid,text),public.validate_poll_input(jsonb),
  public.admin_create_poll(jsonb),public.admin_update_poll(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.get_poll_results(bigint),public.get_poll_catalog(text,boolean),public.get_poll_detail(text,boolean),
  public.submit_vote(bigint,bigint,uuid),public.submit_text_response(bigint,uuid,text),public.validate_poll_input(jsonb),
  public.admin_create_poll(jsonb),public.admin_update_poll(bigint,jsonb) to service_role;
grant update(text_response,updated_at) on public.votes to service_role;
grant insert(text_response) on public.votes to service_role;
-- Draft option replacement is exclusively behind Admin session + transactional checks.
grant delete on public.poll_options to service_role;
notify pgrst,'reload schema';
commit;
