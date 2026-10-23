-- TEST DATABASE ONLY. Apply 20261023040000_board.sql first. All fixtures roll back.
begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); post_id bigint; notice_id bigint; comment_id bigint; result jsonb;
begin
  if has_table_privilege('anon','public.board_posts','select')
    or has_table_privilege('anon','public.board_posts','insert')
    or has_table_privilege('authenticated','public.board_post_comments','select')
    or has_function_privilege('anon','public.write_board_post(bigint,uuid,boolean,text,text,text,boolean)','execute')
    or has_function_privilege('authenticated','public.get_board_page(text,integer)','execute') then raise exception 'Browser roles must not access BOARD directly'; end if;
  insert into public.participants(id,display_name) values(a,'board-test-'||a::text),(b,'board-test-'||b::text);
  post_id:=(public.write_board_post(null,a,false,'일반 글','검색할 본문','general',false)->>'id')::bigint;
  perform public.write_board_post(post_id,a,false,'본인 수정','내용','general',false);
  begin perform public.write_board_post(post_id,b,false,'무단 수정','내용','general',false); raise exception 'Other writer edit succeeded'; exception when sqlstate 'P4030' then null; end;
  begin perform public.delete_board_post(post_id,b,false); raise exception 'Other writer delete succeeded'; exception when sqlstate 'P4030' then null; end;
  begin perform public.write_board_post(null,a,false,'위조 공지','내용','notice',false); raise exception 'Member created notice'; exception when sqlstate 'P4030' then null; end;
  begin perform public.write_board_post(post_id,a,false,'위조 전환','내용','notice',true); raise exception 'Member converted notice'; exception when sqlstate 'P4030' then null; end;
  notice_id:=(public.write_board_post(null,a,true,'관리자 공지','공지 내용','notice',true)->>'id')::bigint;
  if public.get_board_post(notice_id)->>'post_type'<>'notice' then raise exception 'Notice detail missing'; end if;
  begin perform public.write_board_post(notice_id,a,false,'본인 공지 수정','내용','notice',true); raise exception 'Member edited own notice'; exception when sqlstate 'P4030' then null; end;
  begin perform public.delete_board_post(notice_id,a,false); raise exception 'Member deleted notice'; exception when sqlstate 'P4030' then null; end;
  perform public.write_board_post(notice_id,b,true,'고정 해제','공지 내용','notice',false);
  if (public.get_board_post(notice_id)->>'is_pinned')::boolean then raise exception 'Unpin failed'; end if;
  perform public.write_board_post(notice_id,b,true,'일반 전환','공지 내용','general',false);
  if public.get_board_post(notice_id)->>'post_type'<>'general' then raise exception 'Notice conversion failed'; end if;
  comment_id:=(public.create_board_comment(notice_id,a,'일반 전환 글 댓글')->>'id')::bigint;
  begin perform public.delete_board_comment(notice_id,comment_id,b,false); raise exception 'Other writer deleted comment'; exception when sqlstate 'P4030' then null; end;
  perform public.delete_board_comment(notice_id,comment_id,a,false);
  perform public.write_board_post(notice_id,b,true,'다시 공지','공지 내용','notice',true);
  comment_id:=(public.create_board_comment(notice_id,b,'공지에도 모든 참여자 댓글 허용')->>'id')::bigint;
  if (public.get_board_post(notice_id)->>'comment_count')::integer<>1 then raise exception 'Live comment count wrong'; end if;
  perform public.delete_board_comment(notice_id,comment_id,a,true);
  result:=public.get_board_page('다시 공지',1);
  if jsonb_array_length(result->'pinned')<>1 or jsonb_array_length(result->'posts')<>0 then raise exception 'Pinned search separation failed'; end if;
  perform public.delete_board_post(post_id,a,false);
  if public.get_board_post(post_id) is not null or not exists(select 1 from public.board_posts where id=post_id and deleted_at is not null) then raise exception 'Soft deletion failed'; end if;
  begin perform public.create_board_comment(post_id,a,'삭제 글 댓글'); raise exception 'Deleted post accepted comment'; exception when sqlstate 'P4040' then null; end;
  for i in 1..11 loop perform public.write_board_post(null,a,false,'page-fixture-'||a::text||i::text,'body','general',false); end loop;
  result:=public.get_board_page('page-fixture-'||a::text,1);
  if (result->>'total')::integer<>11 or jsonb_array_length(result->'posts')<>10 then raise exception 'Page 1 count failed'; end if;
  if jsonb_array_length(public.get_board_page('page-fixture-'||a::text,2)->'posts')<>1 then raise exception 'Page 2 count failed'; end if;
  perform public.delete_board_post(notice_id,b,true);
end $$;
rollback;
