-- 기존 polls의 ID 타입·외래 키·투표 기록을 유지하면서 MDX용 slug만 추가합니다.
-- Supabase SQL Editor에서 실행한 뒤 seed.sql을 실행하세요.
begin;

alter table public.polls add column if not exists slug text;

update public.polls
set slug = case
  when pg_typeof(id)::text in ('text', 'character varying') then id::text
  else 'poll-' || id::text
end
where slug is null;

alter table public.polls alter column slug set not null;
create unique index if not exists polls_slug_key on public.polls (slug);

notify pgrst, 'reload schema';
commit;
