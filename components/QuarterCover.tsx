type QuarterCoverProps = {
  year: number;
  quarter: number;
};

/** Decorative, data-driven cover; no additional cover image is needed each quarter. */
export function QuarterCover({ year, quarter }: QuarterCoverProps) {
  return (
    <div className="quarter-cover" aria-hidden="true">
      <div className="cover-topline"><span>203 PROJECT</span><span>QUARTERLY SERIES</span></div>
      <div className="cover-art">
        <svg className="cover-orbits" viewBox="0 0 500 500" fill="none">
          <circle cx="250" cy="250" r="215" />
          <circle cx="250" cy="250" r="165" />
          <circle cx="250" cy="250" r="115" />
          <path d="M250 15v470M15 250h470" />
          <circle cx="250" cy="35" r="7" className="cover-orbit-point" />
        </svg>
        <span className="cover-quarter">Q{quarter}</span>
        <span className="cover-cross cover-cross-first">+</span>
        <span className="cover-cross cover-cross-last">+</span>
      </div>
      <div className="cover-bottomline"><span>{year}</span><span>PERSPECTIVE &amp; PROGRESS ↗</span></div>
    </div>
  );
}
