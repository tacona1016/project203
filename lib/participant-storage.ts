import type { Participant } from "@/lib/supabase/types";

export const PARTICIPANT_STORAGE_KEY = "project203_participant";
const LEGACY_KEY = "project203_selected_user";
type Selection = Pick<Participant, "id" | "display_name">;

// 브라우저에서 저장이 차단되면 현재 탭에서만 선택을 유지합니다. 인증 정보가 아닙니다.
let memorySelection: Selection | null = null;
let memoryOnly = false;

export function readSelection(): Selection | null {
  if (memoryOnly) return memorySelection;
  try {
    let value;
    try { value = JSON.parse(localStorage.getItem(PARTICIPANT_STORAGE_KEY) ?? "null"); } catch { return null; }
    return value && typeof value.id === "string" && typeof value.display_name === "string" ? value : null;
  } catch {
    return memorySelection;
  }
}

export function readLegacyName() {
  try { return localStorage.getItem(LEGACY_KEY); } catch { return null; }
}

export function saveSelection(participant: Selection | null) {
  memorySelection = participant;
  try {
    if (participant) localStorage.setItem(PARTICIPANT_STORAGE_KEY, JSON.stringify({ id: participant.id, display_name: participant.display_name }));
    else localStorage.removeItem(PARTICIPANT_STORAGE_KEY);
    localStorage.removeItem(LEGACY_KEY);
    memoryOnly = false;
    return true;
  } catch {
    memoryOnly = true;
    return false;
  }
}
