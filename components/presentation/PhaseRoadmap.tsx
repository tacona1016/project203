import Image from "next/image";

type Phase = {
  title: string;
  period: string;
  budget: string;
  scope: string;
  usage: string;
  image: string;
  alt: string;
};

export function PhaseRoadmap({ phases }: { phases: readonly Phase[] }) {
  return (
    <ol className="phase-roadmap" aria-label="단계별 추진 계획">
      {phases.map((phase, index) => (
        <li key={phase.title}>
          <div className="phase-topline">
            <span className="item-index">PHASE {String(index + 1).padStart(2, "0")}</span>
            <span>{phase.period}</span>
          </div>
          <Image src={phase.image} alt={phase.alt} width={640} height={280} sizes="(min-width: 1024px) 350px, (min-width: 640px) 50vw, 100vw" />
          <h3>{phase.title}</h3>
          <p className="phase-budget">{phase.budget}</p>
          <p className="phase-scope">{phase.scope}</p>
          <div className="phase-usage"><span>이용 구상</span><p>{phase.usage}</p></div>
        </li>
      ))}
    </ol>
  );
}
