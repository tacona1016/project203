import { Slide } from "@/components/presentation/Slide";
import { PresentationChart } from "./theme/PresentationChart";
import { PresentationSource } from "./theme/PresentationCallout";
import { getSurveyOverview } from "@/lib/presentation/survey-data";
import type { SurveyOverview } from "@/lib/presentation/survey-overview";

export async function PresentationSurveyResults() {
  const state = await getSurveyOverview();
  if (state.status !== "ready") return <Slide id="results-overview" number="13" label="2026 Q4 · 설문 조사 결과"><h2>설문 조사 결과</h2><p role="status">{state.status === "withheld" ? "모든 대상 투표의 결과 공개 조건이 충족되면 요약을 표시합니다." : "설문 결과를 불러오지 못했습니다. 잠시 후 새로고침해주세요."}</p></Slide>;
  return <SurveyResultsOverview data={state.data} />;
}

/** Receives aggregates only; never individual responses or member identities. */
export function SurveyResultsOverview({ data }: { data: SurveyOverview }) {
  const getPoll = (id: number) => data.polls.find(poll => poll.id === id)!;
  const audience = data.audience;
  const time = data.snapshot_at_kst;
  const allocation = getPoll(11).allocation!;
  const choiceRows = (id: number, ranked = false) => {
    const rows = getPoll(id).options.map(option => ({ id: option.id, label: option.label, value: option.percentage, detail: `${option.count}명 · ${option.percentage}%`, ...(ranked ? { rank: option.rank } : {}) }));
    return ranked ? rows.sort((a, b) => b.value - a.value) : rows;
  };
  const scoreRows = () => allocation.items.map(item => ({ id: String(item.item), label: item.label, value: item.mean, detail: `${item.mean.toFixed(2)} / 4점` }));
  const limitLabel = (id: number) => getPoll(id).max_choices_per_participant ? `최대 ${getPoll(id).max_choices_per_participant}개` : "제한 없음";
  return (
<div className="presentation-compact-overview">
<Slide id="results-overview" number="13" label="2026 Q4 · 투표 7건 한눈에">

<header className="compact-overview-heading">
<div>
<h2>설문 조사 결과</h2>
<p>2026 Q4 투표 7건 · 사실과 후속 논의를 구분한 요약</p>
</div>
</header>

<section className="compact-direction" data-poll-id="1" aria-label="방향 전환 발의 결과">
<div><strong>방향 전환 발의</strong><span>아파트 전세 → 별장용 토지 구매</span></div>
<div className="compact-direction-votes">
{choiceRows(1).map(row => <span key={row.id}><strong>{row.label} {row.detail}</strong></span>)}
</div>
<p>참여 {getPoll(1).respondents} / {audience.registered}명 · 참여율 {getPoll(1).participation_percentage}%</p>
</section>

<div className="compact-overview-grid">
<article data-poll-id="9" className="compact-result-card">
<h2>일시납 가능 금액</h2>
<PresentationChart rows={choiceRows(9).filter(row => row.value > 0)} caption={"단일선택 · 응답 "+getPoll(9).respondents+"명 · 참여율 "+getPoll(9).participation_percentage+"%"} />
<p className="compact-zero">0명: {choiceRows(9).filter(row => row.value === 0).map(row => row.label).join(" · ")}</p>
<p className="compact-result-note">금액 구간은 납부 확약이나 평균 자금이 아닙니다.</p>
</article>

<article data-poll-id="10" className="compact-result-card">
<h2>토지 소재지 거리 한도</h2>
<PresentationChart rows={choiceRows(10)} caption={"단일선택 · 응답 "+getPoll(10).respondents+"명 · 참여율 "+getPoll(10).participation_percentage+"%"} />
<p className="compact-result-note">최다 구간과 모든 회원의 수용 한도는 다릅니다.</p>
</article>

<article data-poll-id="13" className="compact-result-card">
<h2>방문 가능 빈도</h2>
<PresentationChart rows={choiceRows(13).filter(row => row.value > 0)} caption={"단일선택 · 응답 "+getPoll(13).respondents+"명 · 참여율 "+getPoll(13).participation_percentage+"%"} />
<p className="compact-zero">0명: {choiceRows(13).filter(row => row.value === 0).map(row => row.label).join(" · ")}</p>
<p className="compact-result-note">집에서 1시간 30분 거리 가정 · 연간 횟수 환산 안 함.</p>
</article>

<article data-poll-id="12" className="compact-result-card">
<h2>얻고 싶은 가치</h2>
<PresentationChart rows={choiceRows(12).filter(row => row.value > 0).sort((a,b) => b.value-a.value)} caption={"복수선택 · "+limitLabel(12)+" · 응답 "+getPoll(12).respondents+"명"} />
<p className="compact-zero">0명: {choiceRows(12).filter(row => row.value === 0).map(row => row.label).join(" · ")}</p>
</article>

<article data-poll-id="14" className="compact-result-card">
<h2>선호 지역</h2>
<PresentationChart rows={choiceRows(14, true).filter(row => row.value > 0)} caption={"복수선택 · "+limitLabel(14)+" · 응답 "+getPoll(14).respondents+"명 · 동률 공동순위"} />
<p className="compact-zero">0명: {choiceRows(14).filter(row => row.value === 0).map(row => row.label).join(" · ")}</p>
</article>

<article data-poll-id="11" className="compact-result-card">
<h2>토지·별장 성향</h2>
<PresentationChart rows={scoreRows()} maximum={4} unit="점" caption={"평균 / 4점 · 참여 "+getPoll(11).respondents+"명 · 유효 "+allocation.valid_count+"건"} />
<p className="compact-result-note">문항번호와 점수를 구분해 원래 답변을 반영했습니다.</p>
<p className="compact-zero">{allocation.invalid_count ? "오류 "+allocation.invalid_count+"건 제외" : allocation.valid_count+"명 모두 반영"} · 각 1~4점, 합계 10 검증.</p>
</article>
</div>

<aside className="compact-next-step"><strong>후속 논의</strong><span>만남·쉼의 목적을 바탕으로 예산·이동·이용 빈도를 확인하고 후보지를 비교합니다. 공식 결정은 별도 합의가 필요합니다.</span></aside>
<PresentationSource time={time}><span>비율의 분모: 각 투표 응답자 · 복수선택 선택률 합계는 100% 초과 가능 · 전체 대상은 현재 등록 회원 기준</span></PresentationSource>

</Slide>
</div>

  );
}
