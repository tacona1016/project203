-- 기존 코드의 친구 목록을 DB로 옮긴 초기 데이터입니다. 이후 이름은 Dashboard에서 수정합니다.
-- 이름을 개별 수정한 이후에는 이 초기 seed를 다시 실행하지 마세요.
insert into public.participants (display_name, display_order)
values
  ('김기범', 1), ('김형규', 2), ('박찬호', 3), ('박철희', 4), ('윤석현', 5),
  ('윤태원', 6), ('이도훈', 7), ('이찬희', 8), ('이호준', 9), ('최지웅', 10)
on conflict (display_name) do nothing;
