export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <article className="stat-card">
      <span className="eyebrow">{label}</span>
      <strong className={typeof value === 'string' && value.length > 12 ? 'stat-card-value stat-card-text' : 'stat-card-value'}>{value}</strong>
      {hint ? <span className="muted">{hint}</span> : null}
    </article>
  )
}
