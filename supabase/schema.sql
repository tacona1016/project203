-- 신규 DB의 초기 설치용입니다. 호환되는 초기 스키마에서 재실행이 가능합니다.
-- 새 DB는 이 파일 → migrations/20261021_participants_and_vote_modes.sql → seed_participants.sql → seed.sql 순서입니다.
-- 기존 DB는 최신 migration만 실행합니다. 이 과거 기반 스키마를 최신 migration 이후 재실행하지 마세요.
-- Private-site installation: run 20261023000000_private_site_access.sql LAST.
-- Do not re-run this historical base schema after enabling private-site permissions.
begin;

create table if not exists public.polls (
  id bigint generated always as identity primary key,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  quarter text not null check (quarter ~ '^[0-9]{4}-q[1-4]$'),
  title text not null check (char_length(btrim(title)) between 1 and 300),
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.poll_options (
  id bigint generated always as identity primary key,
  poll_id bigint not null references public.polls(id),
  label text not null check (char_length(btrim(label)) between 1 and 100),
  display_order integer not null check (display_order >= 0),
  unique (poll_id, display_order),
  unique (poll_id, id)
);

create table if not exists public.votes (
  id bigint generated always as identity primary key,
  poll_id bigint not null references public.polls(id),
  option_id bigint not null,
  participant_name text not null check (
    char_length(participant_name) between 1 and 80
    and participant_name = btrim(participant_name)
    and participant_name ~ '[^[:space:]]'
  ),
  created_at timestamptz not null default now(),
  -- 해당 Poll에 속한 선택지만 허용합니다. 중복 투표를 제한하는 UNIQUE는 없습니다.
  foreign key (poll_id, option_id) references public.poll_options(poll_id, id)
);

create table if not exists public.comments (
  id bigint generated always as identity primary key,
  quarter text not null check (quarter ~ '^[0-9]{4}-q[1-4]$'),
  participant_name text not null check (
    char_length(participant_name) between 1 and 80
    and participant_name = btrim(participant_name)
    and participant_name ~ '[^[:space:]]'
  ),
  content text not null check (
    char_length(content) between 1 and 1000
    and content = btrim(content, E' \t\n\r\f')
    and content ~ '[^[:space:]]'
  ),
  created_at timestamptz not null default now()
);

-- 기존 테이블이 있다면 migrations/20261019_poll_slug.sql을 먼저 실행합니다.
create unique index if not exists polls_slug_key on public.polls (slug);
create index if not exists polls_quarter_idx on public.polls (quarter);
create index if not exists votes_poll_option_idx on public.votes (poll_id, option_id);
create index if not exists comments_quarter_date_idx on public.comments (quarter, created_at desc, id desc);

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.votes enable row level security;
alter table public.comments enable row level security;

-- 기본 권한을 제거하고 공개 키에 필요한 작업만 허용합니다.
revoke all on public.polls, public.poll_options, public.votes, public.comments from public, anon, authenticated;
grant usage on schema public to anon;
grant select on public.polls, public.poll_options, public.votes, public.comments to anon;
-- id와 created_at은 DB에서 생성하며 브라우저에서는 지정할 수 없습니다.
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

-- UPDATE/DELETE 권한과 정책은 부여하지 않습니다. 인증·Realtime은 사용하지 않습니다.
commit;
