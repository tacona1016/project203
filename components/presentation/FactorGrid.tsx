import Image from "next/image";

type Factor = {
  title: string;
  description: string;
  image: string;
  href: string;
};

export function FactorGrid({ factors }: { factors: readonly Factor[] }) {
  return (
    <ol className="factor-grid">
      {factors.map((factor, index) => (
        <li key={factor.title}>
          <a href={factor.href}>
            <div className="factor-topline">
              <span className="item-index">{String(index + 1).padStart(2, "0")}</span>
              <Image src={factor.image} alt="" width={720} height={440} sizes="160px" />
            </div>
            <h3>{factor.title}<span aria-hidden="true">↗</span></h3>
            <p>{factor.description}</p>
          </a>
        </li>
      ))}
    </ol>
  );
}
