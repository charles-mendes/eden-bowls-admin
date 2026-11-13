import { useState } from 'react'
import { BrDateInput } from '../BrDateInput'
import {
  dayMonth,
  laterRange,
  laterText,
  nextFromRange,
  nextSevenDays,
  presetOf,
  rangeLabel,
  type DeliveryRange,
  type DeliveryRangeInfo,
} from '../../lib/deliveryRange'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// admin-flow-fixes-5 (PM-29): the delivery range of a shipping queue. `range` is what the URL asks for (null for
// the API's default); `info` is what the queue answered. The API validates; this only offers the choices.
export function DeliveryRangeFilter({
  range,
  info,
  timeZone,
  truncated,
  onChange,
}: {
  range: DeliveryRange | null
  info: DeliveryRangeInfo | null
  timeZone: string
  truncated: boolean
  onChange: (range: DeliveryRange | null) => void
}) {
  const preset = presetOf(range, timeZone)
  // Without a range in the URL the fields show the API's default, never a range left over from the last answer.
  const shown = range ?? (info?.range?.default ? { from: info.range.from, to: info.range.to } : null)
  // The free range is a draft until both dates are filled; the key below resets it when the URL changes.
  const [draft, setDraft] = useState<DeliveryRange>(shown ?? { from: '', to: '' })

  const applyDraft = (next: DeliveryRange) => {
    setDraft(next)
    if (ISO_DATE.test(next.from) && ISO_DATE.test(next.to)) onChange(next)
  }

  // Empties De and Até and goes back to the default period.
  const clearDates = () => {
    setDraft({ from: '', to: '' })
    if (range) onChange(null)
  }

  const answeredTo = info?.range?.to ?? range?.to ?? null
  const later = info?.later ?? 0

  return (
    <div className="delivery-range" aria-label="Período de entrega" role="group">
      <div className="queue-filters">
        <div className="queue-field">
          <span id="delivery-range-label">Entrega</span>
          <div className="segmented" role="group" aria-labelledby="delivery-range-label">
            <button type="button" aria-pressed={preset === 'default'} className={preset === 'default' ? 'active' : ''} onClick={() => onChange(null)}>
              Até amanhã
            </button>
            <button type="button" aria-pressed={preset === 'next7'} className={preset === 'next7' ? 'active' : ''} onClick={() => onChange(nextSevenDays(timeZone))}>
              Próximos 7 dias
            </button>
          </div>
        </div>
        <label className="queue-field">
          De
          <BrDateInput value={draft.from} onChange={(from) => applyDraft({ ...draft, from })} />
        </label>
        <label className="queue-field">
          Até
          <BrDateInput value={draft.to} onChange={(to) => applyDraft({ ...draft, to })} />
        </label>
        {draft.from || draft.to || range ? (
          <button type="button" className="ghost-button queue-filter-clear" onClick={clearDates}>
            Limpar datas
          </button>
        ) : null}
      </div>
      <p className="muted" aria-live="polite">
        Período: {rangeLabel(range, timeZone)}
        {preset === 'default' && info?.range ? ` (atrasados desde ${dayMonth(info.range.from)})` : ''}
      </p>
      {truncated && !info?.next_from ? <div className="warning" role="status">A lista mostra só os primeiros pedidos do período.</div> : null}
      {truncated && info?.next_from ? (
        <div className="warning" role="status">
          A lista não cabe numa página.{' '}
          <button type="button" className="link-button" onClick={() => onChange(nextFromRange(answeredTo ?? info.next_from as string, info.next_from as string))}>
            Ver a partir de {dayMonth(info.next_from)}
          </button>
        </div>
      ) : null}
      {later > 0 && answeredTo ? (
        <p className="muted">
          {laterText(later, answeredTo)}{' '}
          <button type="button" className="link-button" onClick={() => onChange(laterRange(answeredTo))}>
            Ver os próximos dias
          </button>
        </p>
      ) : null}
    </div>
  )
}
