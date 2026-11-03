-- APPROVAL REQUIRED. Storage configuration only; no existing object is touched.
-- Create through the Storage API/Dashboard instead if SQL bucket management is
-- restricted in your environment: private, 3 MiB, image/webp only.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('board-attachments','board-attachments',false,3145728,array['image/webp']) on conflict(id) do nothing;
do $$ begin
  if not exists(select 1 from storage.buckets where id='board-attachments' and not public and file_size_limit=3145728 and allowed_mime_types=array['image/webp']) then
    raise exception 'Existing bucket settings differ; review manually without changing privacy';
  end if;
  if not exists(select 1 from pg_class where oid='storage.objects'::regclass and relrowsecurity) then raise exception 'Storage objects RLS must be enabled'; end if;
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='board_attachments_server_only') then
    create policy board_attachments_server_only on storage.objects as restrictive for all to anon,authenticated
    using(bucket_id<>'board-attachments') with check(bucket_id<>'board-attachments');
  end if;
end $$;
commit;
