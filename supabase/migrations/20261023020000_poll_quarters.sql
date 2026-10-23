-- Review and run AFTER 20261023010000_poll_management.sql.
-- Preserves all IDs, options, votes, comments, participants and poll settings.
-- The application validates quarter membership against data/quarters.ts.
-- DB checks its format; there is deliberately no duplicate DB quarter registry.
begin;

do $$
begin
  if to_regprocedure('public.admin_create_poll(jsonb)') is null
    or has_table_privilege('anon', 'public.polls', 'SELECT')
    or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'polls' and policyname = 'private_site_server_only') then
    raise exception 'Apply the private-site and poll-management migrations first.';
  end if;
end $$;

-- Only this known kickoff poll has an unambiguous historical quarter.
update public.polls set quarter = '2026-q4'
where slug = 'land-priority' and (quarter is null or btrim(quarter) = '');

-- Fail atomically instead of inventing a quarter for other records.
-- If this fails, ROLLBACK, review the listed polls and map each one manually:
--   select id, slug, title, quarter from public.polls
--   where quarter is null or quarter !~ '^[0-9]{4}-q[1-4]$';
--   update public.polls set quarter = '<registered-quarter>' where id = <reviewed-id>;
-- Ensure each chosen quarter is registered in data/quarters.ts; then rerun this file.
do $$
declare unresolved text;
begin
  select string_agg(format('id=%s slug=%s', id, slug), ', ' order by id) into unresolved
  from public.polls where quarter is null or quarter !~ '^[0-9]{4}-q[1-4]$';
  if unresolved is not null then
    raise exception 'Quarter mapping required: %', unresolved
      using hint = 'Assign a reviewed quarter from data/quarters.ts to each listed poll, then rerun.';
  end if;
end $$;

alter table public.polls alter column quarter set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.polls'::regclass and conname = 'polls_quarter_required_format') then
    alter table public.polls add constraint polls_quarter_required_format check (quarter ~ '^[0-9]{4}-q[1-4]$');
  end if;
end $$;
create index if not exists polls_quarter_idx on public.polls (quarter);

-- An UPDATE takes the same poll-row lock as submit_vote. Recheck inside the
-- transaction, so a vote arriving after the edit page loaded also prevents moving.
create or replace function public.guard_poll_quarter() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.quarter is distinct from old.quarter
    and exists (select 1 from public.votes where poll_id = old.id) then
    raise exception using errcode = 'P2031', message = 'Quarter is immutable after voting';
  end if;
  return new;
end $$;
create or replace trigger polls_guard_quarter before update of quarter on public.polls
for each row execute function public.guard_poll_quarter();
revoke all on function public.guard_poll_quarter() from public, anon, authenticated;

create or replace function public.validate_poll_input(p_data jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare start_at timestamptz; end_at timestamptz;
begin
  if jsonb_typeof(p_data->'quarter') is distinct from 'string'
    or coalesce(p_data->>'quarter', '') !~ '^[0-9]{4}-q[1-4]$'
    or jsonb_typeof(p_data->'title') is distinct from 'string'
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
  values (new_slug, p_data->>'quarter', btrim(p_data->>'title'), btrim(p_data->>'description'), p_data->>'vote_mode', p_data->>'vote_mode' = 'multiple',
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
  if target.quarter is distinct from p_data->>'quarter'
    and exists (select 1 from public.votes where poll_id = p_poll_id) then
    raise exception using errcode = 'P2031', message = 'Quarter is immutable after voting';
  end if;
  -- Options and vote mode are immutable after creation, even with zero votes.
  -- This stricter rule keeps option IDs and their meaning stable without deleting rows.
  update public.polls set quarter = p_data->>'quarter', title = btrim(p_data->>'title'), description = btrim(p_data->>'description'),
    allow_vote_change = target.vote_mode = 'single' and (p_data->>'allow_vote_change')::boolean,
    voting_starts_at = (p_data->>'voting_starts_at')::timestamptz,
    voting_ends_at = (p_data->>'voting_ends_at')::timestamptz, is_hidden = (p_data->>'is_hidden')::boolean
  where id = p_poll_id;
  return jsonb_build_object('slug', target.slug);
end $$;


-- Keep existing private-site RLS and grants. Browser roles gain no privileges.
revoke all on function public.validate_poll_input(jsonb), public.admin_create_poll(jsonb),
  public.admin_update_poll(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.validate_poll_input(jsonb), public.admin_create_poll(jsonb),
  public.admin_update_poll(bigint, jsonb) to service_role;
-- submit_vote and its period/status checks are intentionally unchanged.
notify pgrst, 'reload schema';
commit;
