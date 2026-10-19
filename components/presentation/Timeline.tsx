type TimelineStep = {
  title: string;
  description?: string;
  current?: boolean;
};

export function Timeline({ steps }: { steps: readonly TimelineStep[] }) {
  return (
    <ol className="timeline" role="list">
      {steps.map((step, index) => (
        <li key={`${index}-${step.title}`} className={`timeline-step${step.current ? " is-current" : ""}`}>
          <span className="timeline-phase">
            Phase {String(index + 1).padStart(2, "0")}
            {step.current && <span className="timeline-status">현재 단계</span>}
          </span>
          <div>
            <h3>{step.title}</h3>
            {step.description && <p>{step.description}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
