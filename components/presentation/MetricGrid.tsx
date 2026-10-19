type Metric = {
  value: string;
  label: string;
  description?: string;
};

export function MetricGrid({ metrics }: { metrics: readonly Metric[] }) {
  return (
    <dl className="metric-grid">
      {metrics.map((metric) => (
        <div key={metric.label}>
          <dt>{metric.label}</dt>
          <dd>
            <span className="metric-value">{metric.value}</span>
            {metric.description && <span className="metric-description">{metric.description}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
