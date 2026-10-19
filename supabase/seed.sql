-- schema.sql 이후 실행합니다. 재실행해도 기존 투표·댓글은 변경하지 않습니다.
begin;

do $$
declare
  target_poll_id public.polls.id%type;
begin
  select id into target_poll_id from public.polls where slug = 'land-priority';

  if target_poll_id is null then
    -- 기존 Q4 투표가 하나이거나 같은 질문이면 그 ID를 이어 사용합니다.
    select id into target_poll_id
    from public.polls
    where quarter = '2026-q4'
      and (
        title in (
          '우리가 가장 중요하게 봐야 할 기준은?',
          '별장 프로젝트에서 가장 중요하게 생각하는 요소는?'
        )
        or (select count(*) from public.polls where quarter = '2026-q4') = 1
      )
    order by created_at, id
    limit 1;

    if target_poll_id is not null then
      update public.polls set slug = 'land-priority' where id = target_poll_id;
    elsif pg_typeof(target_poll_id)::text in ('text', 'character varying') then
      -- 초기 버전의 text ID 스키마도 지원합니다.
      insert into public.polls (id, slug, quarter, title, description)
      values ('land-priority', 'land-priority', '2026-q4',
        '우리가 가장 중요하게 봐야 할 기준은?',
        '별장 프로젝트에서 가장 중요하게 생각하는 요소를 선택해주세요.')
      returning id into target_poll_id;
    else
      insert into public.polls (slug, quarter, title, description)
      values ('land-priority', '2026-q4',
        '우리가 가장 중요하게 봐야 할 기준은?',
        '별장 프로젝트에서 가장 중요하게 생각하는 요소를 선택해주세요.')
      returning id into target_poll_id;
    end if;
  end if;

  -- 기존 선택지가 있으면 내용과 순서를 유지합니다.
  if not exists (select 1 from public.poll_options where poll_id = target_poll_id) then
    insert into public.poll_options (poll_id, label, display_order)
    values
      (target_poll_id, '접근성', 1),
      (target_poll_id, '토지가격', 2),
      (target_poll_id, '건축 가능성', 3),
      (target_poll_id, '자연환경', 4),
      (target_poll_id, '유지관리 비용', 5);
  end if;
end $$;

commit;
