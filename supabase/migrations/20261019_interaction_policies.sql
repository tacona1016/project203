-- 기존 테이블과 데이터를 유지하고, 요청한 익명 읽기·추가 권한만 재적용합니다.
begin;

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.votes enable row level security;
alter table public.comments enable row level security;

revoke all on public.polls, public.poll_options, public.votes, public.comments from public, anon, authenticated;
grant usage on schema public to anon;
grant select on public.polls, public.poll_options, public.votes, public.comments to anon;
grant insert (poll_id, option_id, participant_name) on public.votes to anon;
grant insert (quarter, participant_name, content) on public.comments to anon;

drop policy if exists polls_read on public.polls;
create policy polls_read on public.polls for select to anon using (true);
drop policy if exists poll_options_read on public.poll_options;
create policy poll_options_read on public.poll_options for select to anon using (true);
drop policy if exists votes_read on public.votes;
create policy votes_read on public.votes for select to anon using (true);
drop policy if exists votes_insert on public.votes;
create policy votes_insert on public.votes for insert to anon with check (true);
drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select to anon using (true);
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to anon with check (true);

notify pgrst, 'reload schema';
commit;

-- SQL Editor에서는 실제 데이터 수를 확인할 수 있습니다.
select polls.id, polls.slug, count(poll_options.id) as option_count
from public.polls
left join public.poll_options on poll_options.poll_id = polls.id
where polls.slug = 'land-priority'
group by polls.id, polls.slug;
