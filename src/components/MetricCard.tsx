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
      <strong className="stat-card-value">{value}</strong>
      {hint ? <span className="muted">{hint}</span> : null}
    </article>
  )
}
