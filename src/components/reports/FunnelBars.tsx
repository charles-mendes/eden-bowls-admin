import { type ReactNode } from 'react'
import { formatCount } from '../../lib/reports'

export type FunnelStage = { label: ReactNode; value: number; conversion?: string | null; key: string }

// Horizontal bars, widths relative to the largest value. Used for the funnel and the recipe mix.
export function FunnelBars({ title, stages, funnel = false }: { title: string; stages: FunnelStage[]; funnel?: boolean }) {
  const max = Math.max(1, ...stages.map((stage) => stage.value))
  const totals = stages.map((stage) => `${typeof stage.label === 'string' ? stage.label : stage.key} ${formatCount(stage.value)}`)

  if (funnel) {
    return (
      <div className="insights-funnel" role="img" aria-label={`${title}: ${totals.join(', ')}`}>
        {stages.map((stage) => (
          <div key={stage.key}>
            {stage.conversion ? <p className="insights-conv">{stage.conversion} converteram</p> : null}
            <div className="insights-funnel-row">
              <span>{stage.label}</span>
              <strong>{formatCount(stage.value)}</strong>
            </div>
            <div className="insights-track">
              <span className="insights-track-fill" style={{ width: `${(stage.value / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div role="img" aria-label={`${title}: ${totals.join(', ')}`}>
      {stages.map((stage) => (
        <div key={stage.key} className="insights-hbar">
          <span>{stage.label}</span>
          <span className="insights-track"><span className="insights-track-fill" style={{ width: `${(stage.value / max) * 100}%` }} /></span>
          <strong>{formatCount(stage.value)}</strong>
        </div>
      ))}
    </div>
  )
}
