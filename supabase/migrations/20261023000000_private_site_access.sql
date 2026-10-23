-- REVIEW BEFORE RUNNING. Apply after the participants/vote-modes migration.
-- Deploy the server-mediated app with all four environment variables at the same time.
-- This changes permissions only. It does not delete, rewrite or renumber any records.
begin;

do $$
begin
  if to_regclass('public.participants') is null
    or to_regprocedure('public.submit_vote(bigint,bigint,uuid)') is null
    or to_regprocedure('public.get_poll_results(bigint)') is null then
    raise exception 'Apply 20261021_participants_and_vote_modes.sql first.';
  end if;
end $$;

-- Preserve the existing policies and enable RLS as defense in depth.
-- Revoke both table and column grants; table REVOKE alone leaves column grants behind.
do $$
declare
  table_name text;
  columns_sql text;
  sequence_name text;
begin
  foreach table_name in array array['participants', 'polls', 'poll_options', 'votes', 'comments'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all privileges on table public.%I from public, anon, authenticated', table_name);
    select string_agg(quote_ident(attname), ', ' order by attnum) into columns_sql
      from pg_attribute where attrelid = format('public.%I', table_name)::regclass and attnum > 0 and not attisdropped;
    execute format('revoke all privileges (%s) on table public.%I from public, anon, authenticated', columns_sql, table_name);

    -- A restrictive policy keeps direct requests denied even if an old SELECT policy remains.
    execute format('drop policy if exists private_site_server_only on public.%I', table_name);
    execute format('create policy private_site_server_only on public.%I as restrictive for all to anon, authenticated using (false) with check (false)', table_name);
    execute format('grant select on table public.%I to service_role', table_name);

    sequence_name := pg_get_serial_sequence(format('public.%I', table_name), 'id');
    if sequence_name is not null then
      execute format('revoke all privileges on sequence %s from public, anon, authenticated', sequence_name);
      if table_name in ('votes', 'comments') then
        execute format('grant usage, select on sequence %s to service_role', sequence_name);
      end if;
    end if;
  end loop;
end $$;

grant usage on schema public to service_role;
grant insert (poll_id, option_id, participant_id) on public.votes to service_role;
grant insert (quarter, participant_id, content) on public.comments to service_role;
-- The existing submit_vote function locks participant and poll rows during validation.
grant update on public.participants, public.polls to service_role;

-- Revoke every overload, including any older name-based RPC left in this project.
do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('submit_vote', 'get_poll_results')
  loop
    execute format('revoke all privileges on function %s from public, anon, authenticated', fn.signature);
  end loop;
end $$;

-- Now only the server calls this function, so caller privileges suffice.
-- All validation, the per-poll lock and single/repeat-vote rules remain unchanged.
alter function public.submit_vote(bigint, bigint, uuid) security invoker;
grant execute on function public.submit_vote(bigint, bigint, uuid) to service_role;
grant execute on function public.get_poll_results(bigint) to service_role;

notify pgrst, 'reload schema';
commit;
