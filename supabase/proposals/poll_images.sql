-- Additive, review/apply ONCE after independent TEST validation and approval.
-- No existing poll/vote/choice/comment rows or RPC definitions are changed.
begin;
create table public.poll_images (
  id uuid primary key,
  poll_id bigint not null references public.polls(id) on delete restrict,
  option_id bigint,
  storage_path text not null unique,
  content_type text not null default 'image/webp' check(content_type='image/webp'),
  byte_size integer not null check(byte_size between 1 and 500000),
  width integer not null check(width between 1 and 1920),
  height integer not null check(height between 1 and 1920),
  sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
  sort_order integer not null check(sort_order between 0 and 2),
  state text not null check(state in ('pending','ready','deleting')),
  upload_token uuid not null,
  -- Retain the old UUID after cleanup for exact idempotent replacement retries.
  replaces_id uuid,
  uploaded_by uuid not null references public.participants(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(option_id is null or sort_order=0),
  foreign key(poll_id,option_id) references public.poll_options(poll_id,id) on delete restrict
);
create index poll_images_poll on public.poll_images(poll_id);
create index poll_images_cleanup on public.poll_images(updated_at) where state<>'ready';
-- Separate pending/ready slots allow a replacement to be verified before swapping.
create unique index poll_images_question_slot on public.poll_images(poll_id,sort_order,state) where option_id is null and state in ('pending','ready');
create unique index poll_images_option_slot on public.poll_images(option_id,state) where option_id is not null and state in ('pending','ready');
alter table public.poll_images enable row level security;
revoke all on public.poll_images from public,anon,authenticated;
grant select,insert,update,delete on public.poll_images to service_role;

create function public.guard_poll_image() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  -- Parent lock serializes every image writer, including direct service writes.
  perform 1 from public.polls where id=new.poll_id for update;
  if new.option_id is not null and not exists(select 1 from public.poll_options where id=new.option_id and poll_id=new.poll_id) then
    raise exception using errcode='23503',message='Image option does not belong to poll';
  end if;
  if new.storage_path <> ('polls/'||new.poll_id||'/'||(case when new.option_id is null then 'questions/' else 'options/'||new.option_id||'/' end)||new.id||'.webp') then
    raise exception using errcode='22023',message='Invalid image path';
  end if;
  return new;
end $$;
create trigger poll_image_guard before insert or update on public.poll_images for each row execute function public.guard_poll_image();

create function public.manage_poll_image(p_poll_id bigint,p_actor_id uuid,p_action text,p_data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare item public.poll_images%rowtype; old public.poll_images%rowtype; target public.polls%rowtype;
  image_id uuid; option_id_value bigint; replace_id uuid; token uuid; slot integer; ids uuid[];
begin
  if not exists(select 1 from public.participants where id=p_actor_id and is_active) then raise exception using errcode='42501',message='Active actor required'; end if;
  select * into target from public.polls where id=p_poll_id for update;
  if not found then raise exception using errcode='P0002',message='Poll missing'; end if;
  -- No admin boolean comes from browser. This RPC is service-only; the server
  -- verifies the separate administrator cookie before every call.
  if p_action='reorder' then
    select array_agg(value::uuid order by ord) into ids from jsonb_array_elements_text(p_data->'ids') with ordinality as x(value,ord);
    if coalesce(cardinality(ids),0)>3 or coalesce(cardinality(ids),0)<>(select count(distinct x) from unnest(ids) x)
      or (select count(*) from public.poll_images where poll_id=p_poll_id and option_id is null and state='ready')<>coalesce(cardinality(ids),0)
      or exists(select 1 from public.poll_images where poll_id=p_poll_id and option_id is null and state='pending')
      or exists(select 1 from unnest(ids) x where not exists(select 1 from public.poll_images where id=x and poll_id=p_poll_id and option_id is null and state='ready')) then
      raise exception using errcode='40001',message='Reload image ordering';
    end if;
    -- Temporarily pending within the same transaction avoids unique slot swaps;
    -- readers see either the whole old ordering or the whole new ordering.
    update public.poll_images set state='pending' where id=any(ids);
    for slot in 1..coalesce(cardinality(ids),0) loop
      update public.poll_images set state='ready',sort_order=slot-1,updated_at=clock_timestamp() where id=ids[slot];
    end loop;
    return jsonb_build_object('reordered',true);
  end if;
  image_id := (p_data->>'id')::uuid;
  token := (p_data->>'token')::uuid;
  select * into item from public.poll_images where id=image_id and poll_id=p_poll_id for update;
  if p_action='reserve' then
    option_id_value := (p_data->>'option_id')::bigint; replace_id := (p_data->>'replaces_id')::uuid;
    if item.id is not null then
      if item.sha256<>p_data->>'sha256' or item.option_id is distinct from option_id_value or item.replaces_id is distinct from replace_id then
        raise exception using errcode='40001',message='Idempotency conflict';
      end if;
      if item.state='ready' then return to_jsonb(item); end if;
      if item.state<>'pending' or item.updated_at>clock_timestamp()-interval '120 seconds' then raise exception using errcode='40001',message='Image busy; check state before retry'; end if;
      update public.poll_images set upload_token=token,updated_at=clock_timestamp() where id=image_id returning * into item;
      return to_jsonb(item);
    end if;
    if option_id_value is not null and (target.poll_type<>'choice' or not exists(select 1 from public.poll_options where id=option_id_value and poll_id=p_poll_id)) then raise exception using errcode='22023',message='Invalid option'; end if;
    if replace_id is not null then
      select * into old from public.poll_images where id=replace_id and poll_id=p_poll_id and option_id is not distinct from option_id_value and state='ready';
      if not found then raise exception using errcode='40001',message='Replacement target changed'; end if;
      slot:=old.sort_order;
    elsif option_id_value is null then
      select n into slot from generate_series(0,2) n where not exists(select 1 from public.poll_images where poll_id=p_poll_id and option_id is null and sort_order=n and state in ('ready','pending')) order by n limit 1;
      if slot is null then raise exception using errcode='23514',message='Question image limit'; end if;
    else
      slot:=0;
      if exists(select 1 from public.poll_images where poll_id=p_poll_id and option_id=option_id_value and state='ready') then raise exception using errcode='23514',message='Option image limit'; end if;
    end if;
    insert into public.poll_images(id,poll_id,option_id,storage_path,byte_size,width,height,sha256,sort_order,state,upload_token,replaces_id,uploaded_by)
    values(image_id,p_poll_id,option_id_value,'polls/'||p_poll_id||'/'||case when option_id_value is null then 'questions/' else 'options/'||option_id_value||'/' end||image_id||'.webp',
      (p_data->>'byte_size')::integer,(p_data->>'width')::integer,(p_data->>'height')::integer,p_data->>'sha256',slot,'pending',token,replace_id,p_actor_id) returning * into item;
  elsif p_action='finish' then
    if item.state='ready' then return to_jsonb(item); end if;
    if item.state is distinct from 'pending' or item.upload_token<>token then raise exception using errcode='40001',message='Lease changed'; end if;
    if item.replaces_id is not null then
      update public.poll_images set state='deleting',upload_token=gen_random_uuid(),updated_at=clock_timestamp() where id=item.replaces_id and state='ready' returning * into old;
      if not found then raise exception using errcode='40001',message='Replacement target changed'; end if;
    end if;
    update public.poll_images set state='ready',updated_at=clock_timestamp() where id=image_id returning * into item;
  elsif p_action='delete' then
    if item.id is null then return null; end if;
    if item.state<>'ready' and item.updated_at>clock_timestamp()-interval '120 seconds' then raise exception using errcode='40001',message='Image busy'; end if;
    update public.poll_images set state='deleting',upload_token=token,updated_at=clock_timestamp() where id=image_id returning * into item;
  elsif p_action='purge' then
    delete from public.poll_images where id=image_id and poll_id=p_poll_id and state='deleting' and upload_token=token;
    return jsonb_build_object('deleted',found);
  else raise exception using errcode='22023',message='Invalid image action'; end if;
  return to_jsonb(item);
end $$;
revoke all on function public.guard_poll_image(),public.manage_poll_image(bigint,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.manage_poll_image(bigint,uuid,text,jsonb) to service_role;
-- No browser policies on storage.objects. Existing bucket is never overwritten.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('poll-attachments','poll-attachments',false,500000,array['image/webp']);
notify pgrst,'reload schema';
commit;
