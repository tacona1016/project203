-- REVIEW ONLY: apply after 20261023030000_poll_types_and_results.sql.
-- Existing votes are an immutable legacy archive for choice polls. This migration
-- never updates/deletes those rows. Text responses continue using votes.
-- Choice results become one selected option per participant, not repeat clicks.
-- PRE-FLIGHT: inspect_choice_ballots.sql shows the exact aggregate change first.
-- If duplicates exist this entire transaction FAILS CLOSED unless, after explicit
-- review/approval, the operator UNCOMMENTS the following SET LOCAL after BEGIN.
-- Approval only deduplicates the new projection; original votes remain untouched.
begin;
-- set local project203.approve_choice_normalization = 'on';

do $$
declare duplicate_groups bigint; extra_rows bigint;
begin
  if to_regprocedure('public.get_poll_detail(text,boolean)') is null
    or has_table_privilege('anon','public.polls','SELECT')
    or not exists(select 1 from pg_policies where schemaname='public' and tablename='polls' and policyname='private_site_server_only') then
    raise exception 'Apply the private-site, management, quarter and poll-type migrations first.';
  end if;
  -- Serialize the initial projection against in-flight submit/admin transactions.
  -- The operator should deploy during a short maintenance window.
  lock table public.polls in exclusive mode;
  lock table public.votes in share mode;
  select count(*),coalesce(sum(row_count-1),0) into duplicate_groups,extra_rows from (
    select count(*) row_count from public.votes v join public.polls p on p.id=v.poll_id
    where p.poll_type='choice' group by v.poll_id,v.participant_id,v.option_id having count(*)>1
  ) duplicates;
  if duplicate_groups>0 and current_setting('project203.approve_choice_normalization',true) is distinct from 'on' then
    raise exception 'Choice normalization requires approval: % duplicate groups, % extra legacy rows. No change applied.',duplicate_groups,extra_rows
      using hint='Review inspect_choice_ballots.sql. Only after approval, enable SET LOCAL project203.approve_choice_normalization = ''on'' inside this transaction and rerun.';
  end if;
  if exists(
    select 1 from public.votes v join public.polls p on p.id=v.poll_id
    where p.poll_type='choice' and p.vote_mode='single'
    group by v.poll_id,v.participant_id having count(distinct v.option_id)>1
  ) then
    raise exception 'A legacy single ballot has multiple distinct options. Review it manually; no vote was changed.';
  end if;
  if duplicate_groups>0 then
    raise notice 'Approved projection: % duplicate groups; canonical total decreases by % selections. All legacy rows remain.',duplicate_groups,extra_rows;
  end if;
end $$;

-- Older dashboard-created schemas may only have poll_options(id) as a key.
-- A composite UNIQUE is required before the (poll_id,option_id) foreign key.
create unique index if not exists poll_options_poll_id_id_key on public.poll_options(poll_id,id);

create table if not exists public.poll_choice_selections (
  poll_id bigint not null references public.polls(id),
  participant_id uuid not null references public.participants(id),
  option_id bigint not null,
  is_selected boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(poll_id,participant_id,option_id),
  foreign key(poll_id,option_id) references public.poll_options(poll_id,id)
);
-- Re-running never reactivates a selection that a member later deselected.
insert into public.poll_choice_selections(poll_id,participant_id,option_id,is_selected,created_at,updated_at)
select v.poll_id,v.participant_id,v.option_id,true,coalesce(min(v.created_at),min(v.updated_at)),max(v.updated_at)
from public.votes v join public.polls p on p.id=v.poll_id
where p.poll_type='choice' and v.option_id is not null and not exists(
  select 1 from public.poll_choice_selections s
  where s.poll_id=v.poll_id and s.participant_id=v.participant_id and s.option_id=v.option_id
)
group by v.poll_id,v.participant_id,v.option_id
on conflict(poll_id,participant_id,option_id) do nothing;

alter table public.poll_choice_selections enable row level security;
revoke all privileges on public.poll_choice_selections from public,anon,authenticated,service_role;
revoke all privileges(poll_id,participant_id,option_id,is_selected,created_at,updated_at)
  on public.poll_choice_selections from public,anon,authenticated;
drop policy if exists private_site_server_only on public.poll_choice_selections;
create policy private_site_server_only on public.poll_choice_selections as restrictive
  for all to anon,authenticated using(false) with check(false);
grant select,insert,update on public.poll_choice_selections to service_role;

create or replace function public.sync_poll_settings() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.poll_type='text' then new.vote_mode:='single';
  elsif tg_op='UPDATE' then
    if new.vote_mode=old.vote_mode and new.allow_repeat_vote is distinct from old.allow_repeat_vote then
      new.vote_mode:=case when new.allow_repeat_vote then 'multiple' else 'single' end;
    end if;
  end if;
  -- Retain the historical compatibility flag; multiple now means a selection set.
  new.allow_repeat_vote:=new.vote_mode='multiple';
  new.updated_at:=clock_timestamp();
  return new;
end $$;

create or replace function public.guard_poll_quarter() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.quarter is distinct from old.quarter and (
    exists(select 1 from public.votes where poll_id=old.id)
    or exists(select 1 from public.poll_choice_selections where poll_id=old.id)
  ) then raise exception using errcode='P2031',message='Quarter is immutable after voting'; end if;
  return new;
end $$;

create or replace function public.guard_poll_content() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if (new.poll_type is distinct from old.poll_type or new.vote_mode is distinct from old.vote_mode) and (
    exists(select 1 from public.votes where poll_id=old.id)
    or exists(select 1 from public.poll_choice_selections where poll_id=old.id)
  ) then raise exception using errcode='P2032',message='Poll type and vote mode are immutable after responding'; end if;
  if new.text_max_length<old.text_max_length and exists(
    select 1 from public.votes where poll_id=old.id and char_length(text_response)>new.text_max_length
  ) then raise exception using errcode='P2033',message='Existing response exceeds new maximum'; end if;
  return new;
end $$;

create or replace function public.guard_poll_choice_selection() returns trigger
language plpgsql security invoker set search_path='' as $$
declare target public.polls%rowtype;
begin
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
end $$;
create or replace trigger poll_choice_selections_guard before insert or update on public.poll_choice_selections
for each row execute function public.guard_poll_choice_selection();

-- Preserve old choice rows even when old clients/scripts attempt direct writes.
-- The existing response-shape constraint and text uniqueness remain unchanged.
create or replace function public.guard_poll_vote() returns trigger
language plpgsql security invoker set search_path='' as $$
declare target public.polls%rowtype;
begin
  if tg_op='UPDATE' and old.option_id is not null then
    raise exception using errcode='P2034',message='Archived choice votes cannot be changed';
  end if;
  select * into target from public.polls where id=new.poll_id for update;
  if not found then raise exception using errcode='22023',message='Poll not found'; end if;
  if target.poll_type='choice' then
    raise exception using errcode='P2034',message='Choice votes are archived; use submit_choice_ballot';
  end if;
  if new.option_id is not null or new.text_response is null then raise exception using errcode='22023',message='Invalid text response'; end if;
  new.text_response:=btrim(new.text_response,E' \t\n\r\f\013');
  if char_length(new.text_response) not between 1 and target.text_max_length or new.text_response !~ '[^[:space:]]' then
    raise exception using errcode='22023',message='Invalid response length';
  end if;
  new.updated_at:=case when tg_op='INSERT' then coalesce(new.created_at,clock_timestamp()) else clock_timestamp() end;
  return new;
end $$;

-- A raw historical count is still available to reviewed server/SQL diagnostics.
-- Never expose this RPC in normal site endpoints: it ignores result visibility.
create or replace function public.get_poll_legacy_results(p_poll_id bigint) returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'counts',coalesce((select jsonb_object_agg(option_id::text,vote_count) from (
      select option_id,count(*) vote_count from public.votes where poll_id=p_poll_id and option_id is not null group by option_id
    ) counts),'{}'::jsonb),
    'total_votes',(select count(*) from public.votes where poll_id=p_poll_id),
    'participant_count',(select count(distinct participant_id) from public.votes where poll_id=p_poll_id)
  );
$$;

create or replace function public.get_poll_results(p_poll_id bigint) returns jsonb
language sql stable security invoker set search_path='' as $$
  select case when (select poll_type from public.polls where id=p_poll_id)='choice' then
    jsonb_build_object(
      'counts',coalesce((select jsonb_object_agg(option_id::text,vote_count) from (
        select option_id,count(*) vote_count from public.poll_choice_selections where poll_id=p_poll_id and is_selected group by option_id
      ) counts),'{}'::jsonb),
      'total_votes',(select count(*) from public.poll_choice_selections where poll_id=p_poll_id and is_selected),
      'participant_count',(select count(distinct participant_id) from public.poll_choice_selections where poll_id=p_poll_id and is_selected)
    ) else public.get_poll_legacy_results(p_poll_id) end;
$$;

-- Site/API code supplies only the member ID verified from its HttpOnly session.
create or replace function public.get_poll_participation(p_poll_id bigint,p_participant_id uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare target public.polls%rowtype; selected_ids bigint[]; response text; response_count bigint; participated boolean;
begin
  select * into target from public.polls where id=p_poll_id and not is_hidden;
  if not found or not exists(select 1 from public.participants where id=p_participant_id and is_active) then return null; end if;
  if target.poll_type='choice' then
    select coalesce(array_agg(option_id order by option_id) filter(where is_selected),'{}'::bigint[]),count(*)>0
      into selected_ids,participated from public.poll_choice_selections where poll_id=p_poll_id and participant_id=p_participant_id;
    return jsonb_build_object('option_id',selected_ids[1],'option_ids',to_jsonb(selected_ids),'text_response',null,
      'vote_count',cardinality(selected_ids),'selection_count',cardinality(selected_ids),'has_participated',participated);
  end if;
  select count(*),min(text_response) into response_count,response from public.votes where poll_id=p_poll_id and participant_id=p_participant_id;
  return jsonb_build_object('option_id',null,'option_ids','[]'::jsonb,'text_response',response,
    'vote_count',response_count,'selection_count',0,'has_participated',response_count>0);
end $$;

create or replace function public.submit_choice_ballot(p_poll_id bigint,p_option_ids bigint[],p_participant_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
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
end $$;

-- Compatibility is limited to old single-choice callers. No append-style
-- multiple request may silently reinterpret or replace an entire selection set.
create or replace function public.submit_vote(p_poll_id bigint,p_option_id bigint,p_participant_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare target public.polls%rowtype;
begin
  select * into target from public.polls where id=p_poll_id for update;
  if not found or target.is_hidden then return jsonb_build_object('status','poll_not_found'); end if;
  if target.poll_type<>'choice' then return jsonb_build_object('status','invalid_poll_type'); end if;
  if target.vote_mode<>'single' then return jsonb_build_object('status','invalid_selection'); end if;
  return public.submit_choice_ballot(p_poll_id,array[p_option_id],p_participant_id);
end $$;

create or replace function public.admin_update_poll(p_poll_id bigint,p_data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare target public.polls%rowtype; has_votes boolean; existing_options jsonb;
begin
  perform public.validate_poll_input(p_data);
  select * into target from public.polls where id=p_poll_id for update;
  if not found then raise exception using errcode='22023',message='Poll not found'; end if;
  select exists(select 1 from public.votes where poll_id=p_poll_id)
    or exists(select 1 from public.poll_choice_selections where poll_id=p_poll_id) into has_votes;
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
    vote_mode=p_data->>'vote_mode',allow_vote_change=(p_data->>'allow_vote_change')::boolean,
    voting_starts_at=(p_data->>'voting_starts_at')::timestamptz,voting_ends_at=(p_data->>'voting_ends_at')::timestamptz,is_hidden=(p_data->>'is_hidden')::boolean where id=p_poll_id;
  if not has_votes and (target.poll_type is distinct from p_data->>'poll_type' or (p_data->>'poll_type'='choice' and existing_options<>p_data->'options')) then
    delete from public.poll_options where poll_id=p_poll_id;
    if p_data->>'poll_type'='choice' then
      insert into public.poll_options(poll_id,label,display_order)
      select p_poll_id,btrim(label),ordering::integer from jsonb_array_elements_text(p_data->'options') with ordinality as choices(label,ordering);
    end if;
  end if;
  return jsonb_build_object('slug',target.slug);
end $$;

revoke all on function public.guard_poll_choice_selection(),public.guard_poll_vote(),public.guard_poll_quarter(),public.guard_poll_content(),public.sync_poll_settings(),
  public.get_poll_legacy_results(bigint),public.get_poll_results(bigint),public.get_poll_participation(bigint,uuid),
  public.submit_choice_ballot(bigint,bigint[],uuid),public.submit_vote(bigint,bigint,uuid),public.admin_update_poll(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.get_poll_legacy_results(bigint),public.get_poll_results(bigint),public.get_poll_participation(bigint,uuid),
  public.submit_choice_ballot(bigint,bigint[],uuid),public.submit_vote(bigint,bigint,uuid),public.admin_update_poll(bigint,jsonb) to service_role;
-- get_poll_catalog/detail and submit_text_response retain their existing guarded
-- policies and service-only grants. No ordinary API exposes legacy result RPC.
notify pgrst,'reload schema';
commit;
