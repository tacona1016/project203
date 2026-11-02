-- REVIEW ONLY. New own-comment edit RPC; no tables, rows or RLS policies change.
-- Apply this new file only after review. Never replay existing schema/seeds.
begin;
do $$ begin
  if to_regclass('public.board_post_comments') is null or to_regclass('public.board_posts') is null then
    raise exception 'The existing BOARD migration must already be applied';
  end if;
end $$;

create or replace function public.edit_board_comment(p_post_id bigint,p_id bigint,p_actor_id uuid,p_content text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare target public.board_post_comments%rowtype;
begin
  if p_content is null or char_length(p_content) not between 1 and 2000 or p_content !~ '[^[:space:]]' then
    raise exception using errcode='22023',message='Invalid comment';
  end if;
  -- Match the existing create/delete lock order, and serialize against post deletion.
  perform 1 from public.board_posts where id=p_post_id and deleted_at is null for update;
  if not found then raise exception using errcode='P4040',message='Post not found'; end if;
  perform 1 from public.participants where id=p_actor_id and is_active for share;
  if not found then raise exception using errcode='P4030',message='Active participant required'; end if;
  select * into target from public.board_post_comments where id=p_id and post_id=p_post_id for update;
  if not found or target.deleted_at is not null then raise exception using errcode='P4040',message='Comment not found'; end if;
  -- Admins retain existing deletion rights, but cannot rewrite someone else's words.
  if target.author_id<>p_actor_id then raise exception using errcode='P4030',message='Own comment required'; end if;
  update public.board_post_comments set content=btrim(p_content) where id=p_id returning * into target;
  return jsonb_build_object('id',target.id,'content',target.content,'updated_at',target.updated_at);
end $$;

revoke all on function public.edit_board_comment(bigint,bigint,uuid,text) from public,anon,authenticated;
grant execute on function public.edit_board_comment(bigint,bigint,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;

-- App rollback: deploy the previous application; all original records/RPCs remain.
-- The unused RPC can remain. Disabling its service_role EXECUTE is a separate
-- reviewed operation, never a reason to restore/delete comment data.
