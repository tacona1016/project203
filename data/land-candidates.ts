export type LandCandidate = {
  id: string; name: string; location: string; priceWon?: number; areaPyeong?: number;
  access: string; buildability: string; road: string; utilities: string;
  terrain: string; surroundings: string; extraCosts: string; needsVerification: string;
  checkedAt?: string; sourceUrl?: string;
};

// Real candidates only, after agreement. Never populate the production DB with examples.
export const landCandidates: readonly LandCandidate[] = [];

export function candidateAmount(value: number | undefined, unit: "원" | "평") {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? `${value.toLocaleString("ko-KR")}${unit}` : "미확인";
}

export function candidateSource(value: string | undefined) {
  try { const url = new URL(value ?? ""); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; }
}
