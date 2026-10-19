export function getPollLoadErrorMessage(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "";

  if (code === "PGRST116") {
    return "등록된 투표를 찾지 못했습니다. 운영자에게 확인해주세요.";
  }
  if (error instanceof Error && error.message === "POLL_OPTIONS_MISSING") {
    return "투표 선택지가 아직 준비되지 않았습니다. 운영자에게 확인해주세요.";
  }
  if (["PGRST205", "42P01", "42703", "PGRST204"].includes(code)) {
    return "투표 데이터가 아직 준비되지 않았습니다. 운영자에게 확인해주세요.";
  }
  if (["42501", "PGRST301", "PGRST302", "PGRST303"].includes(code)) {
    return "투표에 접근할 수 없습니다. 운영자에게 확인해주세요.";
  }
  return "투표를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
}

export function reportPollLoadError(pollId: string, stage: string, error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "UNKNOWN";
  // API 키, URL, 응답 본문은 기록하지 않습니다.
  console.warn("[203 PROJECT] Poll lookup failed", { pollId, stage, code });
}
