-- READ-ONLY baseline/comparison query. Run before and after the APPROVED
-- migration in the SAME repeatable snapshot or account for genuine member use.
-- Only aggregate fingerprints, never raw member information, are returned.
select 'polls_existing_fields' as scope,count(*) as rows,
  md5(coalesce(string_agg((to_jsonb(p)-'max_choices_per_participant')::text,E'\n' order by id),'')) as fingerprint
from public.polls p
union all select 'poll_options',count(*),md5(coalesce(string_agg(to_jsonb(o)::text,E'\n' order by id),'')) from public.poll_options o
union all select 'votes',count(*),md5(coalesce(string_agg(to_jsonb(v)::text,E'\n' order by id),'')) from public.votes v
union all select 'poll_choice_selections',count(*),md5(coalesce(string_agg(to_jsonb(s)::text,E'\n' order by poll_id,participant_id,option_id),'')) from public.poll_choice_selections s
union all select 'participants',count(*),md5(coalesce(string_agg(to_jsonb(p)::text,E'\n' order by id),'')) from public.participants p;
