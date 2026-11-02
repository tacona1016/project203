import { candidateAmount, candidateSource, type LandCandidate } from "@/data/land-candidates";

export function LandComparison({ candidates }: { candidates: readonly LandCandidate[] }) {
  return <section className="land-comparison" aria-labelledby="land-comparison-title">
    <p className="eyebrow text-accent">후보지 검토</p>
    <h2 id="land-comparison-title" className="mt-4 text-3xl font-medium">같은 기준으로 비교하기.</h2>
    <p className="form-note mt-4">Q4 평가 기준에 따라 확인한 사실과 아직 확인할 항목을 구분합니다. 후보 등록은 구매 결정을 뜻하지 않습니다.</p>
    {!candidates.length ? <p className="interaction-notice mt-6">아직 등록된 후보지가 없습니다.</p> : <div className="land-comparison-grid">
      {candidates.map(candidate => {
        const facts = [["위치", candidate.location], ["토지가격", candidateAmount(candidate.priceWon, "원")], ["면적", candidateAmount(candidate.areaPyeong, "평")],
          ["접근성", candidate.access], ["건축 가능성", candidate.buildability], ["도로", candidate.road], ["전기·수도·오수", candidate.utilities],
          ["지형", candidate.terrain], ["주변 환경", candidate.surroundings], ["예상 추가 비용", candidate.extraCosts], ["확인 필요", candidate.needsVerification]];
        const source = candidateSource(candidate.sourceUrl);
        return <article key={candidate.id}><h3 className="text-xl font-medium">{candidate.name}</h3><dl className="mt-6 grid gap-4">{facts.map(([label, value]) => <div key={label}><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 wrap-anywhere">{value || "미확인"}</dd></div>)}</dl>
          {candidate.checkedAt && <p className="form-note mt-6">확인일 <time dateTime={candidate.checkedAt}>{candidate.checkedAt}</time></p>}
          {source && <a className="text-link mt-4" href={source} target="_blank" rel="noopener noreferrer">원자료 확인 ↗</a>}
        </article>;
      })}
    </div>}
  </section>;
}
