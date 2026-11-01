-- READ ONLY. Review before 20261101000000_choice_ballots.sql.
-- No participant names, passwords, response content, or per-member histories.
-- Raw rows are always retained. Canonical choice totals count each participant's
-- selected option once, so duplicate legacy clicks reduce the projected totals.

select p.id,p.slug,p.vote_mode,count(v.id) as raw_choice_rows,
  count(distinct(v.participant_id,v.option_id)) filter(where v.id is not null) as projected_selected_votes,
  count(v.id)-count(distinct(v.participant_id,v.option_id)) filter(where v.id is not null) as duplicate_extra_rows
from public.polls p left join public.votes v on v.poll_id=p.id
where p.poll_type='choice' group by p.id,p.slug,p.vote_mode order by p.created_at,p.id;

select count(*) as duplicate_groups,coalesce(sum(row_count-1),0) as duplicate_extra_rows from (
  select count(*) row_count from public.votes v join public.polls p on p.id=v.poll_id
  where p.poll_type='choice' group by v.poll_id,v.participant_id,v.option_id having count(*)>1
) duplicates;

-- A conflicting legacy SINGLE ballot cannot be resolved automatically, even
-- with normalization approval. This query reports only an aggregate count.
select count(*) as single_ballots_requiring_manual_review from (
  select 1 from public.votes v join public.polls p on p.id=v.poll_id
  where p.poll_type='choice' and p.vote_mode='single'
  group by v.poll_id,v.participant_id having count(distinct v.option_id)>1
) conflicts;

-- AFTER applying the migration, run this separately to compare history/current:
-- select id,slug,public.get_poll_legacy_results(id) as preserved_legacy,
--   public.get_poll_results(id) as current_selections
-- from public.polls where poll_type='choice' order by created_at,id;
