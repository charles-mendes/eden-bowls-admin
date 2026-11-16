import { useEffect, useState } from 'react'
import { Section } from './Section'
import { InfoHint } from './InfoHint'
import { helpText } from './HelpText'
import { BrTimeInput } from './BrDateInput'
import { UsTimeInput } from './UsTimeInput'
import { ApiRequestError } from '../lib/api'
import type { MarketCode } from '../lib/markets'
import {
  WEEKDAY_NAMES,
  describeWeek,
  formatDay,
  formatTime,
  getOperatingWeek,
  previewOperatingWeek,
  saveOperatingWeek,
  type OperatingDay,
  type WeekImpactItem,
  type WeekPreview,
} from '../lib/deliveryCalendar'

// Help of the Semana padrão tab, as the API applies it (firstPrepDay, usPrepValid). One string per paragraph.
const WEEK_HELP = {
  hours: [
    'O horário decide o dia de preparo de cada pagamento, no fuso do mercado.',
    'Pago em dia aberto antes do fechamento: prepara no mesmo dia. Vale também antes da abertura, como uma renovação cobrada às 00:00.',
    'Pago depois do fechamento ou em dia fechado: prepara no próximo dia aberto.',
  ],
  open: [
    'Aberto vale só para o preparo: são os dias em que a cozinha produz.',
    'Coleta e entrega seguem as próprias regras. Feriados e fechamentos de uma data ficam na aba Feriados e fechamentos.',
  ],
} as const

const US_NOTE = 'Nos EUA, sexta e sábado nunca preparam, mesmo abertos: a coleta da UPS cairia no fim de semana. Domingo aberto prepara, com coleta na segunda.'

const TIME_ZONE_LABELS: Record<MarketCode, string> = {
  BR: 'horário de Brasília',
  US: 'horário de Nova York (12 horas, AM/PM)',
}

const OUTCOME_BADGES: Record<WeekImpactItem['outcome'], string> = {
  moved: 'badge-info',
  moved_charge_kept: 'badge-warning',
  kept: 'badge-success',
}

function outcomeText(item: WeekImpactItem) {
  if (item.outcome === 'kept') return 'Mantém a data'
  if (item.outcome === 'moved_charge_kept') return `Cobrança mantida, preparo muda para ${formatDay(item.newPreparationDay)}`
  return `Muda para ${formatDay(item.newPreparationDay)}`
}

// A draft the API can read: every open day with a whole hh:mm, opening before closing.
function draftProblem(days: OperatingDay[]) {
  if (!days.some((day) => day.open)) return 'Abra pelo menos um dia.'
  const bad = days.find((day) => day.open && (!day.opensAt || !day.closesAt || day.opensAt >= day.closesAt))
  return bad ? `${WEEKDAY_NAMES[bad.weekday - 1]}: a abertura precisa ser antes do fechamento.` : ''
}

type OperatingWeekPanelProps = {
  token: string
  market: MarketCode
  canWrite: boolean
  // After a save: the page reloads the history, where the change now shows.
  onSaved: () => void
}

// Semana padrão (delivery-calendar): the weekdays the kitchen prepares and their hours. A save needs a preview of
// the current draft, and sends the moves that preview showed.
export function OperatingWeekPanel({ token, market, canWrite, onSaved }: OperatingWeekPanelProps) {
  const [stored, setStored] = useState<OperatingDay[] | null>(null)
  const [draft, setDraft] = useState<OperatingDay[]>([])
  const [loadedMarket, setLoadedMarket] = useState<MarketCode | null>(null)
  const [preview, setPreview] = useState<WeekPreview | null>(null)
  const [previewedDraft, setPreviewedDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const week = await getOperatingWeek(token, market)
        if (cancelled) return
        setStored(week.days)
        setDraft(week.days)
        setError('')
      } catch (requestError) {
        if (cancelled) return
        setError(requestError instanceof Error && requestError.message ? requestError.message : 'Falha ao carregar a semana padrão.')
      } finally {
        if (!cancelled) {
          setLoadedMarket(market)
          setPreview(null)
          setNotice('')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, market])

  const key = JSON.stringify(draft)
  const changed = stored !== null && key !== JSON.stringify(stored)
  const problem = draftProblem(draft)
  const previewCurrent = preview !== null && previewedDraft === key
  const loading = loadedMarket !== market

  const updateDay = (weekday: number, patch: Partial<OperatingDay>) => {
    setDraft((days) => days.map((day) => (day.weekday === weekday ? { ...day, ...patch } : day)))
    setNotice('')
  }

  const runPreview = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await previewOperatingWeek(token, market, draft)
      setPreview(result)
      setPreviewedDraft(key)
    } catch (requestError) {
      setError(requestError instanceof Error && requestError.message ? requestError.message : 'Falha ao calcular o impacto.')
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!preview) return
    setBusy(true)
    setError('')
    try {
      const result = await saveOperatingWeek(token, market, draft, preview.confirmedMoves)
      setStored(result.days)
      setDraft(result.days)
      setPreview(null)
      setNotice('Semana padrão salva.')
      onSaved()
    } catch (requestError) {
      if (requestError instanceof ApiRequestError && requestError.code === 'week_impact_changed') {
        setPreview(null)
        setError('As entregas afetadas mudaram desde a prévia. Clique em Ver impacto de novo antes de salvar.')
      } else {
        setError(requestError instanceof Error && requestError.message ? requestError.message : 'Falha ao salvar a semana.')
      }
    } finally {
      setBusy(false)
    }
  }

  const readonly = !canWrite || busy
  const firstOpen = draft.find((day) => day.open) || null
  const sameHours = !firstOpen || draft.every((day) => !day.open || (day.opensAt === firstOpen.opensAt && day.closesAt === firstOpen.closesAt))
  const counts = preview ? {
    moved: preview.impact.filter((item) => item.outcome === 'moved').length,
    chargeKept: preview.impact.filter((item) => item.outcome === 'moved_charge_kept').length,
    kept: preview.impact.filter((item) => item.outcome === 'kept').length,
  } : null

  // One tap to give every open day the hours of the first one, the usual case of a kitchen with fixed hours.
  const copyFirstHours = () => {
    if (!firstOpen) return
    setDraft((days) => days.map((day) => (day.open ? { ...day, opensAt: firstOpen.opensAt, closesAt: firstOpen.closesAt } : day)))
    setNotice('')
  }

  return (
    <>
      <Section
        title="Semana padrão"
        description={`Dias e horário de preparo de ${market}, no ${TIME_ZONE_LABELS[market]}.`}
      >
        {stored !== null && !loading ? (
          <p className="week-summary">
            <span className="week-summary-label">Em vigor</span>
            <strong>{describeWeek(stored, market)}</strong>
          </p>
        ) : null}
        {error ? <div className="alert" role="alert">{error}</div> : null}
        {notice ? <div className="success" role="status">{notice}</div> : null}
        {!canWrite ? <p className="readonly-note">Somente leitura: editar a semana exige permissão de produção.</p> : null}
        {market === 'US' ? <p className="week-note">{US_NOTE}</p> : null}

        {loading || stored === null ? (
          error ? null : <p aria-busy="true">Carregando semana padrão…</p>
        ) : (
          <div className="week-table" role="table" aria-label={`Semana padrão de ${market}`}>
            <div className="week-row week-head" role="row">
              <span role="columnheader">Dia</span>
              <span role="columnheader" className="field-label-row">
                Aberto
                <InfoHint id="week-open-help" topic="dia aberto" text={helpText(WEEK_HELP.open)} wide />
              </span>
              <span role="columnheader" className="field-label-row week-hours-head">
                Horário
                <InfoHint id="week-hours-help" topic="horário de preparo" text={helpText(WEEK_HELP.hours)} wide />
              </span>
            </div>
            {draft.map((day) => {
              const name = WEEKDAY_NAMES[day.weekday - 1]
              return (
                <div key={day.weekday} className={day.open ? 'week-row' : 'week-row week-closed'} role="row">
                  <span role="rowheader" className="week-day">{name}</span>
                  <span role="cell">
                    <label className="ship-toggle week-toggle">
                      <input
                        type="checkbox"
                        role="switch"
                        aria-label={`${name} aberto`}
                        aria-describedby="week-open-help"
                        checked={day.open}
                        disabled={readonly}
                        onChange={(event) => updateDay(day.weekday, { open: event.target.checked })}
                      />
                      <span className="ship-toggle-track" aria-hidden="true" />
                      <span>{day.open ? 'Aberto' : 'Fechado'}</span>
                    </label>
                  </span>
                  <span role="cell" className="week-hours">
                    {!day.open ? <span className="week-off">Sem preparo</span> : (<>
                    <label>
                      <span className="week-hours-label">Abre</span>
                      {market === 'US' ? (
                        <UsTimeInput
                          key={`${market}-${day.weekday}-opens`}
                          label={`${name} abre`}
                          describedBy="week-hours-help"
                          value={day.opensAt}
                          className="week-time"
                          disabled={readonly}
                          onChange={(value) => updateDay(day.weekday, { opensAt: value })}
                        />
                      ) : (
                        <BrTimeInput
                          aria-label={`${name} abre`}
                          aria-describedby="week-hours-help"
                          value={day.opensAt}
                          className="week-time"
                          disabled={readonly}
                          onChange={(value) => updateDay(day.weekday, { opensAt: value })}
                        />
                      )}
                    </label>
                    <label>
                      <span className="week-hours-label">Fecha</span>
                      {market === 'US' ? (
                        <UsTimeInput
                          key={`${market}-${day.weekday}-closes`}
                          label={`${name} fecha`}
                          describedBy="week-hours-help"
                          value={day.closesAt}
                          className="week-time"
                          disabled={readonly}
                          onChange={(value) => updateDay(day.weekday, { closesAt: value })}
                        />
                      ) : (
                        <BrTimeInput
                          aria-label={`${name} fecha`}
                          aria-describedby="week-hours-help"
                          value={day.closesAt}
                          className="week-time"
                          disabled={readonly}
                          onChange={(value) => updateDay(day.weekday, { closesAt: value })}
                        />
                      )}
                    </label>
                    </>)}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {canWrite && stored !== null && !loading ? (
          <>
          {firstOpen && !sameHours ? (
            <button className="link-button week-copy" type="button" disabled={busy} onClick={copyFirstHours}>
              Usar {formatTime(firstOpen.opensAt, market)}–{formatTime(firstOpen.closesAt, market)} ({WEEKDAY_NAMES[firstOpen.weekday - 1].toLowerCase()}) em todos os dias abertos
            </button>
          ) : null}
          <div className={changed ? 'week-actions week-actions-dirty' : 'week-actions'}>
            {problem ? <p className="week-problem" role="alert">{problem}</p> : null}
            {changed ? <span className="week-dirty" role="status">Alterações não salvas</span> : null}
            <button className="ghost-button" type="button" disabled={busy || !changed} onClick={() => { setDraft(stored); setPreview(null); setError('') }}>
              Desfazer alterações
            </button>
            <button className="ghost-button" type="button" disabled={busy || !changed || Boolean(problem)} onClick={() => void runPreview()}>
              Ver impacto
            </button>
            <button className="primary-button" type="button" disabled={busy || !changed || !previewCurrent} onClick={() => void save()}>
              Salvar semana
            </button>
            {changed && !previewCurrent && !problem ? <small className="ship-hint">Veja o impacto antes de salvar.</small> : null}
          </div>
          </>
        ) : null}
      </Section>

      {preview && previewCurrent ? (
        <Section title="Impacto da mudança" description="Entregas agendadas cujo dia de preparo muda com esta semana.">
          {preview.impact.length === 0 ? (
            <p role="status" className="week-impact-empty">Nenhuma entrega agendada muda. A semana vale para os pagamentos a partir de agora.</p>
          ) : (
            <>
            {counts ? (
              <ul className="week-impact-counts" aria-label="Resumo do impacto">
                <li><strong>{counts.moved}</strong> {counts.moved === 1 ? 'muda de data' : 'mudam de data'}</li>
                <li><strong>{counts.chargeKept}</strong> {counts.chargeKept === 1 ? 'mantém a cobrança e muda o preparo' : 'mantêm a cobrança e mudam o preparo'}</li>
                <li><strong>{counts.kept}</strong> {counts.kept === 1 ? 'mantém a data' : 'mantêm a data'}</li>
              </ul>
            ) : null}
            <div className="table-shell table-scroll">
              <table className="stack-table" aria-label="Entregas afetadas">
                <thead>
                  <tr>
                    <th>Assinatura</th>
                    <th>Preparo atual</th>
                    <th>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.impact.map((item) => (
                    <tr key={`${item.stripeSubscriptionId}-${item.deliveryId}`}>
                      <td className="stack-table-title">{item.stripeSubscriptionId}</td>
                      <td data-label="Preparo atual" className="nowrap">{formatDay(item.preparationDay)}</td>
                      <td data-label="Resultado"><span className={OUTCOME_BADGES[item.outcome]}>{outcomeText(item)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </Section>
      ) : null}
    </>
  )
}
