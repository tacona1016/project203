-- REVIEW BEFORE RUNNING in SQL Editor. Adds BOARD only; existing tables/records stay unchanged.
begin;

do $$ begin
  if to_regclass('public.participants') is null then raise exception 'participants must exist first'; end if;
end $$;

create table if not exists public.board_posts (
  id bigint generated always as identity primary key,
  author_id uuid not null references public.participants(id),
  title text not null check (char_length(title) between 1 and 160 and title ~ '[^[:space:]]'),
  content text not null check (char_length(content) between 1 and 10000 and content ~ '[^[:space:]]'),
  post_type text not null default 'general' check (post_type in ('general','notice')),
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint board_posts_pin_notice check (not is_pinned or post_type='notice')
);
create table if not exists public.board_post_comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.board_posts(id),
  author_id uuid not null references public.participants(id),
  content text not null check (char_length(content) between 1 and 2000 and content ~ '[^[:space:]]'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists board_posts_recent_idx on public.board_posts(created_at desc,id desc) where deleted_at is null;
create index if not exists board_posts_author_idx on public.board_posts(author_id);
create index if not exists board_posts_pinned_idx on public.board_posts(created_at desc,id desc) where deleted_at is null and is_pinned;
create index if not exists board_comments_post_idx on public.board_post_comments(post_id,created_at,id) where deleted_at is null;
create index if not exists board_comments_author_idx on public.board_post_comments(author_id);

alter table public.board_posts enable row level security;
alter table public.board_post_comments enable row level security;
drop policy if exists board_server_only on public.board_posts;
create policy board_server_only on public.board_posts as restrictive for all to anon,authenticated using(false) with check(false);
drop policy if exists board_server_only on public.board_post_comments;
create policy board_server_only on public.board_post_comments as restrictive for all to anon,authenticated using(false) with check(false);
revoke all on public.board_posts,public.board_post_comments from public,anon,authenticated;
-- Revoke column grants as well on rerun.
revoke all(id,author_id,title,content,post_type,is_pinned,created_at,updated_at,deleted_at) on public.board_posts from public,anon,authenticated;
revoke all(id,post_id,author_id,content,created_at,updated_at,deleted_at) on public.board_post_comments from public,anon,authenticated;
revoke all on sequence public.board_posts_id_seq,public.board_post_comments_id_seq from public,anon,authenticated;
revoke all on public.board_posts,public.board_post_comments from service_role;
grant select,insert,update on public.board_posts,public.board_post_comments to service_role;
grant usage,select on sequence public.board_posts_id_seq,public.board_post_comments_id_seq to service_role;

create or replace function public.board_touch_updated_at() returns trigger
language plpgsql security invoker set search_path='' as $$
begin new.updated_at:=clock_timestamp(); return new; end $$;
create or replace trigger board_posts_updated before update on public.board_posts for each row execute function public.board_touch_updated_at();
create or replace trigger board_comments_updated before update on public.board_post_comments for each row execute function public.board_touch_updated_at();

create or replace function public.get_board_page(p_search text default '',p_page integer default 1) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
  if p_page not between 1 and 999999 or p_search is null or char_length(p_search)>100 then raise exception using errcode='22023',message='Invalid board page'; end if;
  -- Literal substring search: no SQL interpolation, wildcard operators or query grammar.
  with filtered as (
    select p.id,p.author_id,a.display_name as author_name,p.title,p.post_type,p.is_pinned,p.created_at,p.updated_at,
      (select count(*) from public.board_post_comments c where c.post_id=p.id and c.deleted_at is null) as comment_count
    from public.board_posts p join public.participants a on a.id=p.author_id
    where p.deleted_at is null and (p_search='' or strpos(lower(p.title),lower(p_search))>0 or strpos(lower(p.content),lower(p_search))>0)
  ), regular as (select * from filtered where not is_pinned order by created_at desc,id desc limit 10 offset ((p_page-1)*10))
  select jsonb_build_object('pinned',coalesce((select jsonb_agg(to_jsonb(f) order by created_at desc,id desc) from filtered f where is_pinned),'[]'::jsonb),
    'posts',coalesce((select jsonb_agg(to_jsonb(r) order by created_at desc,id desc) from regular r),'[]'::jsonb),
    'total',(select count(*) from filtered where not is_pinned),'page',p_page,'page_size',10) into result;
  return result;
end $$;

create or replace function public.get_board_post(p_id bigint) returns jsonb
language sql stable security invoker set search_path='' as $$
  select to_jsonb(p)||jsonb_build_object('author_name',a.display_name,'comment_count',
    (select count(*) from public.board_post_comments c where c.post_id=p.id and c.deleted_at is null))
  from public.board_posts p join public.participants a on a.id=p.author_id where p.id=p_id and p.deleted_at is null;
$$;

create or replace function public.get_board_comments(p_post_id bigint,p_page integer default 1) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
  if p_page not between 1 and 999999 then raise exception using errcode='22023',message='Invalid comment page'; end if;
  if not exists(select 1 from public.board_posts where id=p_post_id and deleted_at is null) then raise exception using errcode='P4040',message='Post not found'; end if;
  return coalesce((select jsonb_agg(to_jsonb(c) order by created_at,id) from (
    select b.*,a.display_name as author_name from public.board_post_comments b join public.participants a on a.id=b.author_id
    where b.post_id=p_post_id and b.deleted_at is null order by b.created_at,b.id limit 30 offset ((p_page-1)*30)
  ) c),'[]'::jsonb);
end $$;

-- p_actor_id and p_is_admin are supplied ONLY by Next.js after server session checks.
-- None of the functions are executable by browser/anonymous/authenticated roles.
create or replace function public.write_board_post(p_id bigint,p_actor_id uuid,p_is_admin boolean,p_title text,p_content text,p_post_type text,p_is_pinned boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare target public.board_posts%rowtype; result_id bigint;
begin
  if p_is_admin is null or p_title is null or p_content is null or p_post_type is null or p_is_pinned is null
    or char_length(p_title) not between 1 and 160 or p_title !~ '[^[:space:]]'
    or char_length(p_content) not between 1 and 10000 or p_content !~ '[^[:space:]]'
    or p_post_type not in ('general','notice') or (p_is_pinned and p_post_type<>'notice') then
    raise exception using errcode='22023',message='Invalid post';
  end if;
  perform 1 from public.participants where id=p_actor_id and is_active for share;
  if not found then raise exception using errcode='P4030',message='Active participant required'; end if;
  if p_id is null then
    if not p_is_admin and (p_post_type<>'general' or p_is_pinned) then raise exception using errcode='P4030',message='Admin required'; end if;
    insert into public.board_posts(author_id,title,content,post_type,is_pinned)
    values(p_actor_id,btrim(p_title),btrim(p_content),p_post_type,p_is_pinned) returning id into result_id;
  else
    select * into target from public.board_posts where id=p_id for update;
    if not found or target.deleted_at is not null then raise exception using errcode='P4040',message='Post not found'; end if;
    if not p_is_admin and (target.author_id<>p_actor_id or target.post_type='notice' or p_post_type<>target.post_type or p_is_pinned<>target.is_pinned) then
      raise exception using errcode='P4030',message='Post permission denied';
    end if;
    update public.board_posts set title=btrim(p_title),content=btrim(p_content),post_type=p_post_type,is_pinned=p_is_pinned where id=p_id returning id into result_id;
  end if;
  return jsonb_build_object('id',result_id);
end $$;

create or replace function public.delete_board_post(p_id bigint,p_actor_id uuid,p_is_admin boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare target public.board_posts%rowtype;
begin
  if p_is_admin is null then raise exception using errcode='P4030',message='Permission required'; end if;
  perform 1 from public.participants where id=p_actor_id and is_active for share;
  if not found then raise exception using errcode='P4030',message='Active participant required'; end if;
  select * into target from public.board_posts where id=p_id for update;
  if not found or target.deleted_at is not null then raise exception using errcode='P4040',message='Post not found'; end if;
  if not p_is_admin and (target.author_id<>p_actor_id or target.post_type='notice') then raise exception using errcode='P4030',message='Post permission denied'; end if;
  update public.board_posts set deleted_at=clock_timestamp() where id=p_id;
  return jsonb_build_object('success',true);
end $$;

create or replace function public.create_board_comment(p_post_id bigint,p_actor_id uuid,p_content text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result_id bigint;
begin
  if p_content is null or char_length(p_content) not between 1 and 2000 or p_content !~ '[^[:space:]]' then raise exception using errcode='22023',message='Invalid comment'; end if;
  perform 1 from public.board_posts where id=p_post_id and deleted_at is null for update;
  if not found then raise exception using errcode='P4040',message='Post not found'; end if;
  perform 1 from public.participants where id=p_actor_id and is_active for share;
  if not found then raise exception using errcode='P4030',message='Active participant required'; end if;
  insert into public.board_post_comments(post_id,author_id,content) values(p_post_id,p_actor_id,btrim(p_content)) returning id into result_id;
  return jsonb_build_object('id',result_id);
end $$;

create or replace function public.delete_board_comment(p_post_id bigint,p_id bigint,p_actor_id uuid,p_is_admin boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare target public.board_post_comments%rowtype;
begin
  if p_is_admin is null then raise exception using errcode='P4030',message='Permission required'; end if;
  perform 1 from public.board_posts where id=p_post_id and deleted_at is null for update;
  if not found then raise exception using errcode='P4040',message='Post not found'; end if;
  perform 1 from public.participants where id=p_actor_id and is_active for share;
  if not found then raise exception using errcode='P4030',message='Active participant required'; end if;
  select * into target from public.board_post_comments where id=p_id and post_id=p_post_id for update;
  if not found or target.deleted_at is not null then raise exception using errcode='P4040',message='Comment not found'; end if;
  if not p_is_admin and target.author_id<>p_actor_id then raise exception using errcode='P4030',message='Comment permission denied'; end if;
  update public.board_post_comments set deleted_at=clock_timestamp() where id=p_id;
  return jsonb_build_object('success',true);
end $$;

revoke all on function public.board_touch_updated_at(),public.get_board_page(text,integer),public.get_board_post(bigint),public.get_board_comments(bigint,integer),
  public.write_board_post(bigint,uuid,boolean,text,text,text,boolean),public.delete_board_post(bigint,uuid,boolean),
  public.create_board_comment(bigint,uuid,text),public.delete_board_comment(bigint,bigint,uuid,boolean) from public,anon,authenticated;
grant execute on function public.get_board_page(text,integer),public.get_board_post(bigint),public.get_board_comments(bigint,integer),
  public.write_board_post(bigint,uuid,boolean,text,text,text,boolean),public.delete_board_post(bigint,uuid,boolean),
  public.create_board_comment(bigint,uuid,text),public.delete_board_comment(bigint,bigint,uuid,boolean) to service_role;
notify pgrst,'reload schema';
commit;
