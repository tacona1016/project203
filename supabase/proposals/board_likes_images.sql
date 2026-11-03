-- REVIEW ONLY. New BOARD tables/RPCs; no existing content or RPC is replaced.
-- CLI is unavailable in the coding environment. After approval, use
-- `supabase migration new board_likes_images` and copy this reviewed SQL there,
-- or execute ONLY this file in the approved SQL Editor. Never replay old seeds.
begin;
do $$ begin
  if to_regclass('public.board_posts') is null or to_regclass('public.board_post_comments') is null then
    raise exception 'Existing BOARD schema is required';
  end if;
end $$;

create table if not exists public.board_post_likes (
  post_id bigint not null references public.board_posts(id),
  participant_id uuid not null references public.participants(id),
  created_at timestamptz not null default now(),
  primary key(post_id,participant_id)
);
create table if not exists public.board_comment_likes (
  comment_id bigint not null references public.board_post_comments(id),
  participant_id uuid not null references public.participants(id),
  created_at timestamptz not null default now(),
  primary key(comment_id,participant_id)
);
create table if not exists public.board_post_images (
  id uuid primary key,
  post_id bigint not null references public.board_posts(id),
  uploaded_by uuid not null references public.participants(id),
  storage_path text not null unique,
  content_type text not null default 'image/webp' check(content_type='image/webp'),
  byte_size integer not null check(byte_size between 1 and 3145728),
  width integer not null check(width between 1 and 2400),
  height integer not null check(height between 1 and 2400),
  sort_order integer not null check(sort_order between 0 and 2),
  sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
  state text not null default 'pending' check(state in ('pending','ready','deleting')),
  upload_token uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(post_id,sort_order),
  check(storage_path='posts/'||post_id::text||'/'||id::text||'.webp')
);
create index if not exists board_images_cleanup_idx on public.board_post_images(updated_at) where state<>'ready';
create index if not exists board_images_owner_idx on public.board_post_images(uploaded_by);

alter table public.board_post_likes enable row level security;
alter table public.board_comment_likes enable row level security;
alter table public.board_post_images enable row level security;
do $$ declare name text; begin
  foreach name in array array['board_post_likes','board_comment_likes','board_post_images'] loop
    if not exists(select 1 from pg_policies where schemaname='public' and tablename=name and policyname='board_engagement_server_only') then
      execute format('create policy board_engagement_server_only on public.%I as restrictive for all to anon,authenticated using(false) with check(false)',name);
    end if;
    execute format('revoke all on public.%I from public,anon,authenticated',name);
  end loop;
end $$;
grant select,insert,delete on public.board_post_likes,public.board_comment_likes to service_role;
grant select,insert,update,delete on public.board_post_images to service_role;

create or replace function public.get_board_engagement(p_post_id bigint,p_actor_id uuid,p_comment_ids bigint[] default '{}') returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare answer jsonb;
begin
  if p_comment_ids is null or cardinality(p_comment_ids)>30 then raise exception using errcode='22023',message='Invalid comment list'; end if;
  if not exists(select 1 from public.participants where id=p_actor_id and is_active) then raise exception using errcode='P4030',message='Active participant required'; end if;
  if not exists(select 1 from public.board_posts where id=p_post_id and deleted_at is null) then raise exception using errcode='P4040',message='Post not found'; end if;
  if exists(select 1 from unnest(p_comment_ids) q(id) where not exists(select 1 from public.board_post_comments where id=q.id and post_id=p_post_id and deleted_at is null)) then
    raise exception using errcode='P4040',message='Comment not found';
  end if;
  select jsonb_build_object(
    'post',jsonb_build_object('count',(select count(*) from public.board_post_likes where post_id=p_post_id),
      'liked',exists(select 1 from public.board_post_likes where post_id=p_post_id and participant_id=p_actor_id)),
    'comments',coalesce((select jsonb_object_agg(q.id::text,jsonb_build_object(
      'count',(select count(*) from public.board_comment_likes where comment_id=q.id),
      'liked',exists(select 1 from public.board_comment_likes where comment_id=q.id and participant_id=p_actor_id))) from unnest(p_comment_ids) q(id)),'{}'::jsonb),
    'images',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'post_id',i.post_id,'content_type',i.content_type,'byte_size',i.byte_size,
      'width',i.width,'height',i.height,'sort_order',i.sort_order,'created_at',i.created_at) order by i.sort_order)
      from public.board_post_images i where i.post_id=p_post_id and i.state='ready'),'[]'::jsonb)
  ) into answer;
  return answer;
end $$;

create or replace function public.set_board_like(p_post_id bigint,p_comment_id bigint,p_actor_id uuid,p_liked boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
  if p_liked is null then raise exception using errcode='22023',message='Invalid desired state'; end if;
  perform 1 from public.board_posts where id=p_post_id and deleted_at is null for update;
  if not found then raise exception using errcode='P4040',message='Post not found'; end if;
  perform 1 from public.participants where id=p_actor_id and is_active for share;
  if not found then raise exception using errcode='P4030',message='Active participant required'; end if;
  if p_comment_id is null then
    if p_liked then insert into public.board_post_likes(post_id,participant_id) values(p_post_id,p_actor_id) on conflict do nothing;
    else delete from public.board_post_likes where post_id=p_post_id and participant_id=p_actor_id; end if;
    return jsonb_build_object('count',(select count(*) from public.board_post_likes where post_id=p_post_id),'liked',p_liked);
  end if;
  perform 1 from public.board_post_comments where id=p_comment_id and post_id=p_post_id and deleted_at is null for update;
  if not found then raise exception using errcode='P4040',message='Comment not found'; end if;
  if p_liked then insert into public.board_comment_likes(comment_id,participant_id) values(p_comment_id,p_actor_id) on conflict do nothing;
  else delete from public.board_comment_likes where comment_id=p_comment_id and participant_id=p_actor_id; end if;
  return jsonb_build_object('count',(select count(*) from public.board_comment_likes where comment_id=p_comment_id),'liked',p_liked);
end $$;

create or replace function public.reserve_board_image(p_post_id bigint,p_id uuid,p_actor_id uuid,p_is_admin boolean,p_token uuid,p_hash text,p_bytes integer,p_width integer,p_height integer) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare parent public.board_posts%rowtype; item public.board_post_images%rowtype; slot integer;
begin
  if p_id is null or p_token is null or p_hash is null or p_hash !~ '^[0-9a-f]{64}$' or p_bytes is null or p_bytes not between 1 and 3145728
    or p_width is null or p_height is null or p_width not between 1 and 2400 or p_height not between 1 and 2400 or p_is_admin is null then
    raise exception using errcode='22023',message='Invalid image';
  end if;
  -- Tiny DB-only critical section, never held during Storage/network requests.
  -- Serialize quota reservations across posts; pending/deleting objects count too.
  perform pg_catalog.pg_advisory_xact_lock(203,301);
  select * into parent from public.board_posts where id=p_post_id and deleted_at is null for update;
  if not found then raise exception using errcode='P4040',message='Post not found'; end if;
  perform 1 from public.participants where id=p_actor_id and is_active for share;
  if not found or parent.author_id<>p_actor_id or (parent.post_type='notice' and not p_is_admin) then raise exception using errcode='P4030',message='Image author required'; end if;
  select * into item from public.board_post_images where id=p_id for update;
  if found then
    if item.post_id<>p_post_id or item.uploaded_by<>p_actor_id or item.sha256<>p_hash then raise exception using errcode='P4090',message='Idempotency key conflict'; end if;
    if item.state='ready' then return to_jsonb(item); end if;
    if item.updated_at>clock_timestamp()-interval '2 minutes' then raise exception using errcode='P4090',message='Image operation in progress'; end if;
    update public.board_post_images set state='pending',upload_token=p_token,updated_at=clock_timestamp() where id=p_id returning * into item;
    return to_jsonb(item);
  end if;
  if (select coalesce(sum(byte_size),0) from public.board_post_images where uploaded_by=p_actor_id)+p_bytes>78643200
    or (select coalesce(sum(byte_size),0) from public.board_post_images)+p_bytes>786432000 then
    raise exception using errcode='P4090',message='Image quota exceeded';
  end if;
  select q.n into slot from generate_series(0,2) q(n) where not exists(select 1 from public.board_post_images where post_id=p_post_id and sort_order=q.n) order by q.n limit 1;
  if slot is null then raise exception using errcode='P4090',message='Three image limit'; end if;
  insert into public.board_post_images(id,post_id,uploaded_by,storage_path,byte_size,width,height,sort_order,sha256,upload_token)
    values(p_id,p_post_id,p_actor_id,'posts/'||p_post_id::text||'/'||p_id::text||'.webp',p_bytes,p_width,p_height,slot,p_hash,p_token) returning * into item;
  return to_jsonb(item);
end $$;

create or replace function public.finish_board_image(p_post_id bigint,p_id uuid,p_actor_id uuid,p_is_admin boolean,p_token uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare item public.board_post_images%rowtype;
begin
  perform 1 from public.board_posts where id=p_post_id and author_id=p_actor_id and deleted_at is null and (post_type='general' or p_is_admin is true) for update;
  if not found then raise exception using errcode='P4040',message='Post not found'; end if;
  perform 1 from public.participants where id=p_actor_id and is_active for share;
  if not found then raise exception using errcode='P4030',message='Active participant required'; end if;
  select * into item from public.board_post_images where id=p_id and post_id=p_post_id and uploaded_by=p_actor_id for update;
  if not found or item.upload_token<>p_token or item.state<>'pending' then raise exception using errcode='P4090',message='Image lease changed'; end if;
  update public.board_post_images set state='ready',updated_at=clock_timestamp() where id=p_id returning * into item;
  return to_jsonb(item);
end $$;

create or replace function public.get_board_image(p_post_id bigint,p_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
  select to_jsonb(i) from public.board_post_images i join public.board_posts p on p.id=i.post_id
  where i.id=p_id and i.post_id=p_post_id and i.state='ready' and p.deleted_at is null;
$$;

create or replace function public.begin_board_image_delete(p_post_id bigint,p_id uuid,p_actor_id uuid,p_is_admin boolean,p_token uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare parent public.board_posts%rowtype; item public.board_post_images%rowtype;
begin
  if p_is_admin is null or p_token is null then raise exception using errcode='22023',message='Invalid operation'; end if;
  select * into parent from public.board_posts where id=p_post_id and deleted_at is null for update;
  if not found then raise exception using errcode='P4040',message='Post not found'; end if;
  perform 1 from public.participants where id=p_actor_id and is_active for share;
  if not found or parent.author_id<>p_actor_id or (parent.post_type='notice' and not p_is_admin) then raise exception using errcode='P4030',message='Image author required'; end if;
  select * into item from public.board_post_images where id=p_id and post_id=p_post_id for update;
  if not found then return null; end if;
  if item.state='pending' and item.updated_at>clock_timestamp()-interval '2 minutes' then raise exception using errcode='P4090',message='Upload in progress'; end if;
  update public.board_post_images set state='deleting',upload_token=p_token,updated_at=clock_timestamp() where id=p_id returning * into item;
  return to_jsonb(item);
end $$;

-- Claim a pending failure before removing Storage bytes; never claim ready data.
create or replace function public.abort_board_image(p_id uuid,p_token uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare item public.board_post_images%rowtype; parent_id bigint;
begin
  select post_id into parent_id from public.board_post_images where id=p_id;
  if not found then return null; end if;
  perform 1 from public.board_posts where id=parent_id for update;
  select * into item from public.board_post_images where id=p_id for update;
  if not found or item.upload_token<>p_token or item.state<>'pending' then return null; end if;
  update public.board_post_images set state='deleting',updated_at=clock_timestamp() where id=p_id returning * into item;
  return to_jsonb(item);
end $$;

-- Purge tracking ONLY after Storage remove succeeded (also for aborts).
create or replace function public.purge_board_image(p_id uuid,p_token uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
  delete from public.board_post_images where id=p_id and upload_token=p_token and state in ('pending','deleting');
  return jsonb_build_object('deleted',not exists(select 1 from public.board_post_images where id=p_id));
end $$;

-- Explicit maintenance only, not a public endpoint or an automatic cron.
create or replace function public.board_image_cleanup_candidates() returns jsonb
language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(q.id),'[]'::jsonb) from (select i.id from public.board_post_images i join public.board_posts p on p.id=i.post_id
    where (i.state<>'ready' and i.updated_at<clock_timestamp()-interval '1 day') or p.deleted_at<clock_timestamp()-interval '1 day'
    order by i.updated_at limit 100) q;
$$;
create or replace function public.claim_board_image_cleanup(p_id uuid,p_token uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare item public.board_post_images%rowtype; removed_at timestamptz; parent_id bigint;
begin
  if p_token is null then raise exception using errcode='22023',message='Token required'; end if;
  select post_id into parent_id from public.board_post_images where id=p_id;
  if not found then return null; end if;
  select deleted_at into removed_at from public.board_posts where id=parent_id for update;
  select * into item from public.board_post_images where id=p_id for update;
  if not found or not coalesce((item.state<>'ready' and item.updated_at<clock_timestamp()-interval '1 day') or removed_at<clock_timestamp()-interval '1 day',false) then return null; end if;
  update public.board_post_images set state='deleting',upload_token=p_token,updated_at=clock_timestamp() where id=p_id returning * into item;
  return to_jsonb(item);
end $$;

revoke all on function public.get_board_engagement(bigint,uuid,bigint[]),public.set_board_like(bigint,bigint,uuid,boolean),
  public.reserve_board_image(bigint,uuid,uuid,boolean,uuid,text,integer,integer,integer),public.finish_board_image(bigint,uuid,uuid,boolean,uuid),
  public.get_board_image(bigint,uuid),public.begin_board_image_delete(bigint,uuid,uuid,boolean,uuid),public.abort_board_image(uuid,uuid),public.purge_board_image(uuid,uuid),
  public.board_image_cleanup_candidates(),public.claim_board_image_cleanup(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_board_engagement(bigint,uuid,bigint[]),public.set_board_like(bigint,bigint,uuid,boolean),
  public.reserve_board_image(bigint,uuid,uuid,boolean,uuid,text,integer,integer,integer),public.finish_board_image(bigint,uuid,uuid,boolean,uuid),
  public.get_board_image(bigint,uuid),public.begin_board_image_delete(bigint,uuid,uuid,boolean,uuid),public.abort_board_image(uuid,uuid),public.purge_board_image(uuid,uuid),
  public.board_image_cleanup_candidates(),public.claim_board_image_cleanup(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
