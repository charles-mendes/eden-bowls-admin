import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatCount } from '../../lib/reports'

export type FunnelStage = { label: ReactNode; value: number; conversion?: string | null; key: string; to?: string; conversionTo?: string }

// Horizontal bars, widths relative to the largest value. Used for the funnel and the recipe mix.
// A stage with `to` links its number to the details; `conversionTo` does the same for the conversion line.
export function FunnelBars({ title, stages, funnel = false }: { title: string; stages: FunnelStage[]; funnel?: boolean }) {
  const max = Math.max(1, ...stages.map((stage) => stage.value))
  const totals = stages.map((stage) => `${typeof stage.label === 'string' ? stage.label : stage.key} ${formatCount(stage.value)}`)
  const role = stages.some((stage) => stage.to || stage.conversionTo) ? 'group' : 'img'
  const number = (stage: FunnelStage) => (stage.to
    ? <Link to={stage.to} className="table-link" aria-label={`${typeof stage.label === 'string' ? stage.label : stage.key}: ${formatCount(stage.value)}`}><strong>{formatCount(stage.value)}</strong></Link>
    : <strong>{formatCount(stage.value)}</strong>)

  if (funnel) {
    return (
      <div className="insights-funnel" role={role} aria-label={`${title}: ${totals.join(', ')}`}>
        {stages.map((stage) => (
          <div key={stage.key}>
            {stage.conversion ? (
              <p className="insights-conv">
                {stage.conversionTo ? <Link to={stage.conversionTo} className="table-link">{stage.conversion} converteram</Link> : `${stage.conversion} converteram`}
              </p>
            ) : null}
            <div className="insights-funnel-row">
              <span>{stage.label}</span>
              {number(stage)}
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
    <div role={role} aria-label={`${title}: ${totals.join(', ')}`}>
      {stages.map((stage) => (
        <div key={stage.key} className="insights-hbar">
          <span>{stage.label}</span>
          <span className="insights-track"><span className="insights-track-fill" style={{ width: `${(stage.value / max) * 100}%` }} /></span>
          {number(stage)}
        </div>
      ))}
    </div>
  )
}
