-- TEST database ONLY. Run after the new proposal, never on Production.
begin;
do $$
declare actor uuid := gen_random_uuid(); p bigint; opt bigint; image_id uuid; token uuid; item jsonb;
  before_votes bigint; before_selections bigint; options_before jsonb; i integer; second_image uuid; before_result jsonb;
begin
  insert into public.participants(id,display_name,is_active,display_order) values(actor,'Synthetic image TEST',true,999);
  insert into public.polls(slug,quarter,title,description) values('isolated-image-test-'||actor,'2099-q1','TEST','TEST') returning id into p;
  insert into public.poll_options(poll_id,label,display_order) values(p,'A',1) returning id into opt;
  insert into public.poll_options(poll_id,label,display_order) values(p,'B',2);
  perform public.submit_choice_ballot(p,array[opt],actor);
  before_result:=public.get_poll_results(p);
  select count(*) into before_votes from public.votes;
  select count(*) into before_selections from public.poll_choice_selections;
  select jsonb_agg(to_jsonb(o) order by id) into options_before from public.poll_options o where poll_id=p;
  for i in 1..3 loop
    image_id:=gen_random_uuid(); token:=gen_random_uuid();
    item:=public.manage_poll_image(p,actor,'reserve',jsonb_build_object('id',image_id,'token',token,'sha256',repeat('a',64),'byte_size',100,'width',10,'height',5));
    assert item->>'state'='pending';
    perform public.manage_poll_image(p,actor,'finish',jsonb_build_object('id',image_id,'token',token));
  end loop;
  begin
    perform public.manage_poll_image(p,actor,'reserve',jsonb_build_object('id',gen_random_uuid(),'token',gen_random_uuid(),'sha256',repeat('b',64),'byte_size',100,'width',10,'height',5));
    raise exception 'Fourth question was accepted';
  exception when check_violation then null; end;
  image_id:=gen_random_uuid(); token:=gen_random_uuid();
  item:=public.manage_poll_image(p,actor,'reserve',jsonb_build_object('id',image_id,'token',token,'option_id',opt,'sha256',repeat('c',64),'byte_size',100,'width',10,'height',5));
  perform public.manage_poll_image(p,actor,'finish',jsonb_build_object('id',image_id,'token',token));
  assert (public.manage_poll_image(p,actor,'reserve',jsonb_build_object('id',image_id,'token',token,'option_id',opt,'sha256',repeat('c',64),'byte_size',100,'width',10,'height',5))->>'state')='ready';
  begin
    perform public.manage_poll_image(p,actor,'reserve',jsonb_build_object('id',gen_random_uuid(),'token',gen_random_uuid(),'option_id',opt,'sha256',repeat('d',64),'byte_size',100,'width',10,'height',5));
    raise exception 'Second option image was accepted';
  exception when check_violation then null; end;
  -- Replacement keeps the previous ready until finish, then atomically swaps.
  second_image:=gen_random_uuid();token:=gen_random_uuid();
  perform public.manage_poll_image(p,actor,'reserve',jsonb_build_object('id',second_image,'token',token,'option_id',opt,'replaces_id',image_id,'sha256',repeat('e',64),'byte_size',100,'width',10,'height',5));
  assert (select state='ready' from public.poll_images where id=image_id);
  perform public.manage_poll_image(p,actor,'finish',jsonb_build_object('id',second_image,'token',token));
  assert (select state='deleting' from public.poll_images where id=image_id);
  assert (select state='ready' from public.poll_images where id=second_image);
  assert options_before=(select jsonb_agg(to_jsonb(o) order by id) from public.poll_options o where poll_id=p);
  assert before_votes=(select count(*) from public.votes);
  assert before_selections=(select count(*) from public.poll_choice_selections);
  assert before_result=public.get_poll_results(p);
  assert not has_table_privilege('anon','public.poll_images','SELECT');
  assert not has_function_privilege('authenticated','public.manage_poll_image(bigint,uuid,text,jsonb)','EXECUTE');
  assert (select not public from storage.buckets where id='poll-attachments');
end $$;
rollback;
