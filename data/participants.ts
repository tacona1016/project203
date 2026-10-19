// 이 목록만 수정하면 모든 이름 선택 UI에 반영됩니다.
// 이름을 바꿔도 이미 저장된 투표·댓글의 작성자 이름은 유지됩니다.
export const participants: readonly string[] = [
  "김기범", "김형규", "박찬호", "박철희", "윤석현",
  "윤태원", "이도훈", "이찬희", "이호준", "최지웅",
];

export function isParticipant(name: string | null): name is string {
  return name !== null && participants.includes(name);
}
