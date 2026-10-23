-- Review and run AFTER 20261023000000_private_site_access.sql.
-- Existing IDs, participants, votes, comments and options are preserved.
begin;

do $$
begin
  if has_table_privilege('anon', 'public.polls', 'SELECT')
    or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'polls' and policyname = 'private_site_server_only')
    or to_regprocedure('public.submit_vote(bigint,bigint,uuid)') is null then
    raise exception 'Apply the participants and private-site migrations first.';
  end if;
end $$;

alter table public.polls add column if not exists vote_mode text;
update public.polls set vote_mode = case when allow_repeat_vote then 'multiple' else 'single' end where vote_mode is null;
alter table public.polls alter column vote_mode set default 'single';
alter table public.polls alter column vote_mode set not null;
alter table public.polls alter column quarter drop not null;
alter table public.polls add column if not exists allow_vote_change boolean not null default false;
alter table public.polls add column if not exists voting_starts_at timestamptz;
alter table public.polls add column if not exists voting_ends_at timestamptz;
alter table public.polls add column if not exists is_closed boolean not null default false;
alter table public.polls add column if not exists is_hidden boolean not null default false;
alter table public.polls add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.polls'::regclass and conname = 'polls_vote_mode_valid') then
    alter table public.polls add constraint polls_vote_mode_valid check (vote_mode in ('single', 'multiple'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.polls'::regclass and conname = 'polls_period_valid') then
    alter table public.polls add constraint polls_period_valid check (voting_starts_at is null or voting_ends_at is null or voting_ends_at > voting_starts_at);
  end if;
end $$;

-- Keep the legacy flag for old records/integrations, with vote_mode as the new setting.
create or replace function public.sync_poll_settings() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.vote_mode = old.vote_mode and new.allow_repeat_vote is distinct from old.allow_repeat_vote then
      new.vote_mode := case when new.allow_repeat_vote then 'multiple' else 'single' end;
    end if;
  end if;
  new.allow_repeat_vote := new.vote_mode = 'multiple';
  if new.vote_mode = 'multiple' then new.allow_vote_change := false; end if;
  new.updated_at := clock_timestamp();
  return new;
end $$;
create or replace trigger polls_sync_settings before insert or update on public.polls
for each row execute function public.sync_poll_settings();
revoke all on function public.sync_poll_settings() from public, anon, authenticated;

-- A single database clock supplies both list status and a timestamp for the UI.
create or replace function public.get_poll_catalog(p_slug text default null, p_include_hidden boolean default false)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(item order by created_at desc nulls last, id desc), '[]'::jsonb) from (
    select p.created_at, p.id, jsonb_build_object(
      'poll', to_jsonb(p), 'server_time', statement_timestamp(),
      'status', case
        when p.is_hidden then 'HIDDEN'
        when p.is_closed or (p.voting_ends_at is not null and statement_timestamp() >= p.voting_ends_at) then 'CLOSED'
        when p.voting_starts_at is not null and statement_timestamp() < p.voting_starts_at then 'UPCOMING'
        else 'ACTIVE' end,
      'results', public.get_poll_results(p.id)
    ) as item
    from public.polls p where (p_slug is null or p.slug = p_slug) and (p_include_hidden or not p.is_hidden)
  ) items;
$$;

create or replace function public.submit_vote(p_poll_id bigint, p_option_id bigint, p_participant_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  target public.polls%rowtype;
  previous_id bigint;
  previous_option bigint;
  previous_count bigint;
  checked_at timestamptz;
begin
  -- Admin edits/close and every vote use the same lock, including concurrent changes.
  select * into target from public.polls where id = p_poll_id for update;
  if not found or target.is_hidden then return jsonb_build_object('status', 'poll_not_found'); end if;
  perform 1 from public.participants where id = p_participant_id and is_active for share;
  if not found then return jsonb_build_object('status', 'inactive_participant'); end if;
  -- Re-read wall time after both locks; a wait must not bypass the deadline.
  checked_at := clock_timestamp();
  if target.is_closed or (target.voting_ends_at is not null and checked_at >= target.voting_ends_at) then
    return jsonb_build_object('status', 'poll_closed');
  end if;
  if target.voting_starts_at is not null and checked_at < target.voting_starts_at then
    return jsonb_build_object('status', 'poll_upcoming');
  end if;
  if not exists (select 1 from public.poll_options where id = p_option_id and poll_id = p_poll_id) then
    return jsonb_build_object('status', 'invalid_option');
  end if;
  if target.vote_mode = 'single' then
    select count(*) into previous_count from public.votes where poll_id = p_poll_id and participant_id = p_participant_id;
    if previous_count > 0 then
      if not target.allow_vote_change then return jsonb_build_object('status', 'already_voted'); end if;
      -- Preserve historical duplicate rows rather than silently deleting or merging them.
      if previous_count > 1 then return jsonb_build_object('status', 'legacy_votes_conflict'); end if;
      select id, option_id into previous_id, previous_option from public.votes where poll_id = p_poll_id and participant_id = p_participant_id;
      if previous_option = p_option_id then return jsonb_build_object('status', 'unchanged'); end if;
      update public.votes set option_id = p_option_id where id = previous_id;
      return jsonb_build_object('status', 'vote_changed');
    end if;
  end if;
  insert into public.votes (poll_id, option_id, participant_id) values (p_poll_id, p_option_id, p_participant_id);
  return jsonb_build_object('status', 'success');
end $$;

-- Shared validation for the two service-only Admin transactions.
create or replace function public.validate_poll_input(p_data jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare start_at timestamptz; end_at timestamptz;
begin
  if jsonb_typeof(p_data->'title') is distinct from 'string'
    or char_length(btrim(p_data->>'title')) not between 1 and 160
    or jsonb_typeof(p_data->'description') is distinct from 'string'
    or char_length(p_data->>'description') > 2000
    or coalesce(p_data->>'vote_mode', '') not in ('single', 'multiple')
    or jsonb_typeof(p_data->'allow_vote_change') is distinct from 'boolean'
    or jsonb_typeof(p_data->'is_hidden') is distinct from 'boolean' then
    raise exception using errcode = '22023', message = 'Invalid poll settings';
  end if;
  start_at := (p_data->>'voting_starts_at')::timestamptz;
  end_at := (p_data->>'voting_ends_at')::timestamptz;
  if (start_at is null) <> (end_at is null) or end_at <= start_at then
    raise exception using errcode = '22023', message = 'Invalid voting period';
  end if;
end $$;

create or replace function public.admin_create_poll(p_data jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare new_id bigint; new_slug text := 'poll-' || gen_random_uuid()::text;
begin
  perform public.validate_poll_input(p_data);
  if jsonb_typeof(p_data->'options') is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Options must be an array';
  end if;
  if jsonb_array_length(p_data->'options') not between 2 and 20 or exists (
    select 1 from jsonb_array_elements(p_data->'options') o
    where jsonb_typeof(o) <> 'string' or char_length(btrim(o #>> '{}')) not between 1 and 120
  ) then raise exception using errcode = '22023', message = 'Invalid options'; end if;
  insert into public.polls (slug, quarter, title, description, vote_mode, allow_repeat_vote, allow_vote_change, voting_starts_at, voting_ends_at, is_hidden)
  values (new_slug, null, btrim(p_data->>'title'), btrim(p_data->>'description'), p_data->>'vote_mode', p_data->>'vote_mode' = 'multiple',
    p_data->>'vote_mode' = 'single' and (p_data->>'allow_vote_change')::boolean,
    (p_data->>'voting_starts_at')::timestamptz, (p_data->>'voting_ends_at')::timestamptz, (p_data->>'is_hidden')::boolean)
  returning id into new_id;
  insert into public.poll_options (poll_id, label, display_order)
  select new_id, btrim(label), ordering::integer from jsonb_array_elements_text(p_data->'options') with ordinality as choices(label, ordering);
  return jsonb_build_object('slug', new_slug);
end $$;

create or replace function public.admin_update_poll(p_poll_id bigint, p_data jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare target public.polls%rowtype;
begin
  perform public.validate_poll_input(p_data);
  select * into target from public.polls where id = p_poll_id for update;
  if not found then raise exception using errcode = '22023', message = 'Poll not found'; end if;
  if target.vote_mode <> p_data->>'vote_mode' then
    raise exception using errcode = '22023', message = 'Vote mode is immutable';
  end if;
  -- Options and vote mode are immutable after creation, even with zero votes.
  -- This stricter rule keeps option IDs and their meaning stable without deleting rows.
  update public.polls set title = btrim(p_data->>'title'), description = btrim(p_data->>'description'),
    allow_vote_change = target.vote_mode = 'single' and (p_data->>'allow_vote_change')::boolean,
    voting_starts_at = (p_data->>'voting_starts_at')::timestamptz,
    voting_ends_at = (p_data->>'voting_ends_at')::timestamptz, is_hidden = (p_data->>'is_hidden')::boolean
  where id = p_poll_id;
  return jsonb_build_object('slug', target.slug);
end $$;

create or replace function public.admin_set_poll_state(p_poll_id bigint, p_action text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare target public.polls%rowtype;
begin
  if p_action not in ('close', 'reopen', 'hide', 'unhide') or p_action is null then
    raise exception using errcode = '22023', message = 'Invalid action';
  end if;
  select * into target from public.polls where id = p_poll_id for update;
  if not found then raise exception using errcode = '22023', message = 'Poll not found'; end if;
  update public.polls set
    is_closed = case when p_action = 'close' then true when p_action = 'reopen' then false else is_closed end,
    is_hidden = case when p_action = 'hide' then true when p_action = 'unhide' then false else is_hidden end
  where id = p_poll_id;
  return jsonb_build_object('slug', target.slug);
end $$;

-- New functions are server-only. Never grant these capabilities to browser roles.
revoke all on function public.get_poll_catalog(text, boolean), public.validate_poll_input(jsonb),
  public.admin_create_poll(jsonb), public.admin_update_poll(bigint, jsonb), public.admin_set_poll_state(bigint, text),
  public.submit_vote(bigint, bigint, uuid) from public, anon, authenticated;
grant execute on function public.get_poll_catalog(text, boolean), public.validate_poll_input(jsonb),
  public.admin_create_poll(jsonb), public.admin_update_poll(bigint, jsonb), public.admin_set_poll_state(bigint, text),
  public.submit_vote(bigint, bigint, uuid) to service_role;
grant insert on public.polls, public.poll_options to service_role;
grant update on public.polls to service_role;
grant update (option_id) on public.votes to service_role;
do $$
declare table_name text; sequence_name text;
begin
  foreach table_name in array array['polls', 'poll_options'] loop
    sequence_name := pg_get_serial_sequence(format('public.%I', table_name), 'id');
    if sequence_name is not null then execute format('grant usage, select on sequence %s to service_role', sequence_name); end if;
  end loop;
end $$;
notify pgrst, 'reload schema';
commit;
