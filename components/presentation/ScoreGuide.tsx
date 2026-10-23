import Image from "next/image";

type ScoreFactor = {
  title: string;
  image: string;
  alt: string;
  levels: readonly [string, string, string, string];
};

/** A static discussion guide. This component does not collect or save responses. */
export function ScoreGuide({ factors }: { factors: readonly ScoreFactor[] }) {
  return (
    <div className="score-guide">
      {factors.map((factor) => (
        <article key={factor.title}>
          <Image src={factor.image} alt={factor.alt} width={720} height={440} sizes="(min-width: 1024px) 260px, (min-width: 640px) 45vw, 100vw" />
          <h3>{factor.title}</h3>
          <ol>
            {factor.levels.map((level, index) => (
              <li key={level}><span>{index + 1}<small>점</small></span><p>{level}</p></li>
            ))}
          </ol>
        </article>
      ))}
    </div>
  );
}
