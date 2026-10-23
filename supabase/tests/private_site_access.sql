-- Read-only assertions after applying the private-site migration.
-- Run manually in SQL Editor. No application rows are inserted, updated or deleted.
do $$
declare
  role_name text;
  table_name text;
  operation text;
  fn record;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    foreach table_name in array array['participants', 'polls', 'poll_options', 'votes', 'comments'] loop
      foreach operation in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] loop
        if has_table_privilege(role_name, format('public.%I', table_name), operation) then
          raise exception '% retains % on %', role_name, operation, table_name;
        end if;
      end loop;
      foreach operation in array array['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] loop
        if has_any_column_privilege(role_name, format('public.%I', table_name), operation) then
          raise exception '% retains column % on %', role_name, operation, table_name;
        end if;
      end loop;
    end loop;
    for fn in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('submit_vote', 'get_poll_results') loop
      if has_function_privilege(role_name, fn.oid, 'EXECUTE') then raise exception '% can execute private RPC', role_name; end if;
    end loop;
  end loop;
  if not has_function_privilege('service_role', 'public.submit_vote(bigint,bigint,uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.get_poll_results(bigint)', 'EXECUTE') then
    raise exception 'Server RPC privileges are missing';
  end if;
end $$;
