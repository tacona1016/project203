type Row = { id: number | string; label: string; value: number; detail: string; rank?: number };
/** Server-rendered bars: labels carry both quantity and denominator; no client data fetch. */
export function PresentationChart({ rows, maximum = 100, unit = "%", caption }: { rows: Row[]; maximum?: number; unit?: string; caption: string }) {
  return <figure className="presentation-chart"><figcaption>{caption}</figcaption><ol>{rows.map(row => <li key={row.id}>
    <div className="presentation-chart-label">{row.rank !== undefined && <span className="presentation-rank">{row.rank}위</span>}<span>{row.label}</span><strong>{row.detail}</strong></div>
    <div className="presentation-chart-track" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, row.value / maximum * 100))}%` }} /></div>
    <span className="sr-only">{row.value}{unit}</span>
  </li>)}</ol></figure>;
}
