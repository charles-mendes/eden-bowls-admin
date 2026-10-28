import { type ReactNode } from 'react'
import { formatDelta, formatKpi, type Kpi, type KpiKind } from '../../lib/reports'
import { type MarketCode } from '../../lib/markets'

// A period card shows the change against the previous period; a point-in-time card says "agora".
export function KpiCard({
  label,
  kpi,
  kind = 'count',
  market,
  now = false,
  lowerIsBetter = false,
  badge,
  hint,
}: {
  label: string
  kpi: Kpi
  kind?: KpiKind
  market: MarketCode
  now?: boolean
  lowerIsBetter?: boolean
  badge?: ReactNode
  hint?: ReactNode
}) {
  const delta = now ? null : formatDelta(kpi.value, kpi.previous, kind)
  const up = kpi.value !== null && kpi.previous !== null && kpi.value > kpi.previous
  const down = kpi.value !== null && kpi.previous !== null && kpi.value < kpi.previous
  const good = lowerIsBetter ? down : up
  const bad = lowerIsBetter ? up : down

  return (
    <div className="day-card">
      <span className="day-card-label">{label} {badge}</span>
      <strong className="insights-value">{formatKpi(kpi.value, kind, market)}</strong>
      {now ? <span className="muted">agora</span> : null}
      {delta ? (
        <span className={good ? 'insights-delta-good' : bad ? 'insights-delta-bad' : 'muted'}>
          {delta} <span className="muted">vs. período anterior</span>
        </span>
      ) : null}
      {hint ? <span className="day-card-hint">{hint}</span> : null}
    </div>
  )
}
