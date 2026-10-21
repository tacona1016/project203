-- 기존 bigint ID와 기록을 유지합니다. Supabase SQL Editor에서 전체를 실행하세요.
begin;

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  display_name text not null unique check (display_name = btrim(display_name) and display_name <> ''),
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.polls add column if not exists allow_repeat_vote boolean not null default false;
alter table public.votes add column if not exists participant_id uuid;
alter table public.comments add column if not exists participant_id uuid;

-- 과거 이름은 같은 이름의 참가자 한 명으로 연결합니다. 기존 중복 표는 삭제하지 않습니다.
insert into public.participants (display_name, is_active)
select distinct coalesce(nullif(btrim(participant_name), ''), '이름 미지정'),
  nullif(btrim(participant_name), '') is not null
from (
  select participant_name from public.votes where participant_id is null
  union all
  select participant_name from public.comments where participant_id is null
) legacy
on conflict (display_name) do nothing;

update public.votes v set participant_id = p.id
from public.participants p
where v.participant_id is null
  and p.display_name = coalesce(nullif(btrim(v.participant_name), ''), '이름 미지정');
update public.comments c set participant_id = p.id
from public.participants p
where c.participant_id is null
  and p.display_name = coalesce(nullif(btrim(c.participant_name), ''), '이름 미지정');

alter table public.votes alter column participant_id set not null;
alter table public.comments alter column participant_id set not null;
-- 기존 이름 열은 이관 전 기록으로 남기고 새 데이터에서는 사용하지 않습니다.
alter table public.votes alter column participant_name drop not null;
alter table public.comments alter column participant_name drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.votes'::regclass and conname = 'votes_participant_id_fkey') then
    alter table public.votes add constraint votes_participant_id_fkey foreign key (participant_id) references public.participants(id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.comments'::regclass and conname = 'comments_participant_id_fkey') then
    alter table public.comments add constraint comments_participant_id_fkey foreign key (participant_id) references public.participants(id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.comments'::regclass and conname = 'comments_content_valid') then
    alter table public.comments add constraint comments_content_valid check (
      content is not null and char_length(content) between 1 and 1000
      and content = btrim(content, E' \t\n\r\f') and content ~ '[^[:space:]]'
    ) not valid;
  end if;
end $$;

create index if not exists votes_poll_participant_idx on public.votes (poll_id, participant_id);
create index if not exists votes_participant_idx on public.votes (participant_id);
create index if not exists poll_options_poll_idx on public.poll_options (poll_id);
create index if not exists comments_participant_idx on public.comments (participant_id);
create index if not exists comments_quarter_date_idx on public.comments (quarter, created_at desc, id desc);

alter table public.participants enable row level security;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.votes enable row level security;
alter table public.comments enable row level security;

revoke all on public.participants, public.polls, public.poll_options, public.votes, public.comments from public, anon, authenticated;
-- 테이블 권한과 별개로 남아 있는 과거의 열 단위 INSERT 권한도 제거합니다.
revoke all (id, poll_id, option_id, participant_name, participant_id, created_at) on public.votes from public, anon, authenticated;
revoke all (id, quarter, participant_name, participant_id, content, created_at) on public.comments from public, anon, authenticated;
grant usage on schema public to anon;
grant select on public.participants, public.polls, public.poll_options, public.votes, public.comments to anon;
grant insert (quarter, participant_id, content) on public.comments to anon;

drop policy if exists participants_read on public.participants;
create policy participants_read on public.participants for select to anon using (true);
drop policy if exists polls_read on public.polls;
create policy polls_read on public.polls for select to anon using (true);
drop policy if exists poll_options_read on public.poll_options;
create policy poll_options_read on public.poll_options for select to anon using (true);
drop policy if exists votes_read on public.votes;
create policy votes_read on public.votes for select to anon using (true);
drop policy if exists votes_insert on public.votes;
drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select to anon using (true);
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to anon with check (
  exists (select 1 from public.participants p where p.id = participant_id and p.is_active)
);
drop policy if exists comments_active_participant on public.comments;
create policy comments_active_participant on public.comments as restrictive for insert to anon with check (
  exists (select 1 from public.participants p where p.id = participant_id and p.is_active)
);

-- 의도적으로 공개하는 유일한 쓰기 RPC입니다. Auth 대신 선택된 참가자 ID를 검증합니다.
-- 이름 선택은 본인 인증이 아니며, 다른 활성 참가자 ID를 선택하는 것까지 방지하지 않습니다.
create or replace function public.submit_vote(p_poll_id bigint, p_option_id bigint, p_participant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  repeat_allowed boolean;
begin
  perform 1 from public.participants where id = p_participant_id and is_active for share;
  if not found then return jsonb_build_object('status', 'inactive_participant'); end if;

  -- 10명 규모에서는 Poll 행 하나의 잠금으로 동시 요청을 직렬화하면 충분합니다.
  select allow_repeat_vote into repeat_allowed from public.polls where id = p_poll_id for update;
  if not found then return jsonb_build_object('status', 'poll_not_found'); end if;
  if not exists (select 1 from public.poll_options where id = p_option_id and poll_id = p_poll_id) then
    return jsonb_build_object('status', 'invalid_option');
  end if;
  if not repeat_allowed and exists (
    select 1 from public.votes where poll_id = p_poll_id and participant_id = p_participant_id
  ) then return jsonb_build_object('status', 'already_voted'); end if;

  insert into public.votes (poll_id, option_id, participant_id)
  values (p_poll_id, p_option_id, p_participant_id);
  return jsonb_build_object('status', 'success');
end;
$$;

-- 집계는 호출자의 SELECT 권한과 RLS를 따르며 기본 조회 행 제한에 잘리지 않습니다.
create or replace function public.get_poll_results(p_poll_id bigint)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'counts', coalesce((select jsonb_object_agg(option_id::text, vote_count) from (
      select option_id, count(*) as vote_count from public.votes where poll_id = p_poll_id group by option_id
    ) counts), '{}'::jsonb),
    'total_votes', (select count(*) from public.votes where poll_id = p_poll_id),
    'participant_count', (select count(distinct participant_id) from public.votes where poll_id = p_poll_id)
  );
$$;

revoke all on function public.submit_vote(bigint, bigint, uuid) from public, anon, authenticated;
revoke all on function public.get_poll_results(bigint) from public, anon, authenticated;
grant execute on function public.submit_vote(bigint, bigint, uuid) to anon;
grant execute on function public.get_poll_results(bigint) to anon;

update public.polls set allow_repeat_vote = false where slug = 'land-priority';
notify pgrst, 'reload schema';
commit;
