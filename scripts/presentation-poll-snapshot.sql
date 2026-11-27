-- Read-only, one statement/MVCC snapshot. Returns aggregates only: no names,
-- member UUIDs, response text, proposal authors, or individual score vectors.
with stamp as materialized (select statement_timestamp() as at),
audience as (select count(*) as registered,count(*) filter(where is_active) as active from public.participants),
targets as (
  select p.*,not p.is_hidden and (p.results_visibility='live' or p.is_closed or p.voting_ends_at<=(select at from stamp)) as visible
  from public.polls p where p.id in (1,9,10,11,12,13,14)
),
choices as (
  select s.poll_id,s.participant_id,s.option_id from public.poll_choice_selections s
  join targets p on p.id=s.poll_id where p.visible and p.poll_type='choice' and s.is_selected
),
texts as (
  select v.participant_id,count(*) over(partition by v.participant_id) as copies,
    case when numbered.line_count=4 and numbered.matched_count=4 and numbered.label_count=4 then numbered.scores
      else array(select m[1] from regexp_matches(v.text_response,'[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)','g') m) end as nums,
    case when numbered.line_count=4 and numbered.matched_count=4 and numbered.label_count=4 then 'numbered_items' else 'plain' end as parse_format
  from public.votes v join targets p on p.id=v.poll_id
  cross join lateral (
    select count(*) as line_count,count(m) as matched_count,count(distinct m[1]) as label_count,
      array_agg(m[2] order by m[1]) as scores
    from (
      select regexp_match(line,'^[[:space:]]*([1-4])[.)][[:space:]]+([+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+))[[:space:]]*$') as m
      from regexp_split_to_table(replace(v.text_response,chr(13),''),chr(10)) as lines(line)
      where line !~ '^[[:space:]]*$'
    ) parsed
  ) numbered
  where p.id=11 and p.visible and p.poll_type='text'
),
validated as (
  select *,case when copies<>1 then 'duplicate_participant' when cardinality(nums)<>4 then 'number_count'
    when exists(select 1 from unnest(nums) n where n !~ '^[1-4]$') then 'integer_range'
    when (select sum(n::integer) from unnest(nums) n)<>10 then 'sum_not_10' else null end as error
  from texts
),
scores as (select n::integer as score,position::integer as item from validated,unnest(nums) with ordinality as x(n,position) where error is null),
score_summary as (
  select item,count(*) as valid_n,round(avg(score),4) as mean,
    percentile_cont(0.5) within group(order by score) as median,min(score) as minimum,max(score) as maximum,
    round(stddev_pop(score)::numeric,4) as population_standard_deviation
  from scores group by item
),
poll_rows as (
  select p.id,p.slug,p.title,p.poll_type,p.vote_mode,p.results_visibility,p.is_closed,p.is_hidden,p.voting_starts_at,p.voting_ends_at,
    p.max_choices_per_participant,p.visible,
    case when p.is_hidden then 'HIDDEN' when p.is_closed or p.voting_ends_at<=(select at from stamp) then 'CLOSED'
      when p.voting_starts_at>(select at from stamp) then 'UPCOMING' else 'ACTIVE' end as status,
    case when not p.visible then null when p.poll_type='choice' then (select count(distinct participant_id) from choices where poll_id=p.id)
      else (select count(distinct participant_id) from validated) end as respondents,
    case when not p.visible then null when p.poll_type='choice' then (select count(*) from choices where poll_id=p.id)
      else (select count(*) from validated) end as raw_response_count,
    case when p.poll_type='choice' and p.visible then
      (select jsonb_agg(jsonb_build_object('id',o.id,'label',o.label,'display_order',o.display_order,'count',(select count(*) from choices s where s.poll_id=p.id and s.option_id=o.id)) order by o.display_order,o.id)
       from public.poll_options o where o.poll_id=p.id) else null end as options,
    case when p.id=11 and p.visible then jsonb_build_object(
      'valid_count',(select count(*) from validated where error is null),
      'invalid_count',(select count(distinct participant_id) from validated where error is not null),
      'duplicate_respondent_count',(select count(distinct participant_id) from validated where copies>1),
      'format_counts',(select coalesce(jsonb_object_agg(parse_format,n),'{}'::jsonb) from (select parse_format,count(*) n from validated where error is null group by parse_format) f),
      'errors',(select coalesce(jsonb_object_agg(error,n),'{}'::jsonb) from (select error,count(distinct participant_id) n from validated where error is not null group by error) e),
      'items',(select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('label',(array['거리(접근성)','토지 넓이','주변 환경','건축시기'])[a.item],'label_status','user_confirmed',
        'distribution',(select jsonb_object_agg(s,(select count(*) from scores where item=a.item and score=s)) from generate_series(1,4) s)) order by item),'[]'::jsonb) from score_summary a)
    ) else null end as allocation,
    case when p.poll_type='choice' and p.visible then jsonb_build_object(
      'duplicate_active_rows',(select count(*)-count(distinct (participant_id,option_id)) from choices where poll_id=p.id),
      'wrong_option_rows',(select count(*) from choices s where s.poll_id=p.id and not exists(select 1 from public.poll_options o where o.id=s.option_id and o.poll_id=p.id)),
      'over_limit_respondents',(select count(*) from (select participant_id from choices s where s.poll_id=p.id group by participant_id having count(*)>case when p.vote_mode='single' then 1 else coalesce(p.max_choices_per_participant,20) end) q)
    ) else null end as validation
  from targets p
)
select jsonb_build_object('snapshot_at_utc',(select at from stamp),
  'snapshot_at_kst',to_char((select at from stamp) at time zone 'Asia/Seoul','YYYY-MM-DD HH24:MI:SS')||'+09:00',
  'audience',(select jsonb_build_object('registered',registered,'active',active,'denominator','current_registered_members_including_inactive') from audience),
  'target_ids','[1,9,10,11,12,13,14]'::jsonb,'excluded_ids','[6,7,8]'::jsonb,
  'choice_source','poll_choice_selections.is_selected=true','text_source','votes.text_response; database-side aggregate only',
  'score_policy','Four scores 1..4 summing 10; explicit numbered 1..4 lines distinguish item numbers from scores; no value repair; population standard deviation',
  'score_parser_version',2,
  'score_labels','User-confirmed order: 거리(접근성), 토지 넓이, 주변 환경, 건축시기',
  'polls',(select jsonb_agg(to_jsonb(p) order by id) from poll_rows p)) as snapshot;
