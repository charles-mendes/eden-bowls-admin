import { useMemo, useState } from 'react'
import { Pager } from './Pager'
import { formatDate } from '../lib/format'
import {
  ACTION_LABELS,
  describeValues,
  formatDay,
  MOVE_LABELS,
  type CalendarHistoryItem,
} from '../lib/deliveryCalendar'

const PAGE_SIZE = 20

const EMPTY_FILTERS = { action: '', actor: '', search: '' }

type Filters = typeof EMPTY_FILTERS

// Text a search can hit: date, label, actor, and every subscription the event touched.
function searchableText(item: CalendarHistoryItem) {
  const meta = item.metadata
  return [
    meta.closedOn,
    formatDay(meta.closedOn),
    meta.label,
    item.actorEmail,
    meta.stripeSubscriptionId,
    ...(meta.moved ?? []).map((moved) => moved.stripeSubscriptionId),
  ].filter(Boolean).join(' ').toLowerCase()
}

// The audit log of one market and year. The API returns the whole year at once, so filters and pages run here.
export function DeliveryCalendarHistory({ items, timeZone }: { items: CalendarHistoryItem[]; timeZone: string }) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)

  const actors = useMemo(
    () => [...new Set(items.map((item) => item.actorEmail).filter((email): email is string => Boolean(email)))].sort(),
    [items],
  )
  const actions = useMemo(() => [...new Set(items.map((item) => item.action))], [items])

  const filtered = useMemo(() => {
    const term = filters.search.trim().toLowerCase()
    return items.filter((item) => (
      (!filters.action || item.action === filters.action)
      && (!filters.actor || item.actorEmail === filters.actor)
      && (!term || searchableText(item).includes(term))
    ))
  }, [items, filters])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, totalPages)
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const filtering = filters.action !== '' || filters.actor !== '' || filters.search !== ''

  const update = (patch: Partial<Filters>) => {
    setFilters((previous) => ({ ...previous, ...patch }))
    setPage(1)
  }

  if (items.length === 0) {
    return <p className="history-empty">Nenhuma mudança registrada neste ano.</p>
  }

  return (
    <>
      <div className="history-filters" role="search" aria-label="Filtrar histórico">
        <label>
          Buscar
          <input
            type="search"
            aria-label="Buscar no histórico"
            placeholder="Rótulo, data, e-mail ou assinatura"
            value={filters.search}
            onChange={(event) => update({ search: event.target.value })}
          />
        </label>
        <label>
          Ação
          <select aria-label="Ação" value={filters.action} onChange={(event) => update({ action: event.target.value })}>
            <option value="">Todas</option>
            {actions.map((action) => <option key={action} value={action}>{ACTION_LABELS[action] || action}</option>)}
          </select>
        </label>
        <label>
          Responsável
          <select aria-label="Responsável" value={filters.actor} onChange={(event) => update({ actor: event.target.value })}>
            <option value="">Todos</option>
            {actors.map((actor) => <option key={actor} value={actor}>{actor}</option>)}
          </select>
        </label>
        {filtering ? (
          <button type="button" className="ghost-button history-clear" onClick={() => update(EMPTY_FILTERS)}>
            Limpar filtros
          </button>
        ) : null}
      </div>

      <p className="history-count" aria-live="polite">
        {filtered.length === 0
          ? 'Nenhuma mudança encontrada.'
          : `Mostrando ${(current - 1) * PAGE_SIZE + 1}–${(current - 1) * PAGE_SIZE + visible.length} de ${filtered.length}${filtering ? ` (de ${items.length} no ano)` : ''}`}
      </p>

      {filtered.length === 0 ? (
        <div className="history-empty">
          <p>Nenhuma mudança corresponde aos filtros.</p>
          <button type="button" className="ghost-button" onClick={() => update(EMPTY_FILTERS)}>Limpar filtros</button>
        </div>
      ) : (
        <div className="table-shell table-scroll">
          <table className="history-table">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Quem</th>
                <th>Ação</th>
                <th>Data</th>
                <th>Antes</th>
                <th>Depois</th>
                <th>Assinaturas</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => {
                const meta = item.metadata
                const resend = item.action === 'delivery_calendar.sync_resend'
                const moved = meta.moved ?? []
                return (
                  <tr key={item.id}>
                    <td className="nowrap">{formatDate(item.createdAt)}</td>
                    <td>{item.actorEmail || '—'}</td>
                    <td><span className="history-action">{ACTION_LABELS[item.action] || item.action}</span></td>
                    <td className="nowrap">{formatDay(meta.closedOn)}{meta.label ? <div className="muted">{meta.label}</div> : null}</td>
                    <td>{resend ? `Esperada ${formatDate(meta.expectedTrialEnd, timeZone)} · encontrada ${formatDate(meta.foundTrialEnd, timeZone)}` : describeValues(meta.before)}</td>
                    <td>{resend ? `Alvo ${formatDate(meta.targetTrialEnd, timeZone)}` : describeValues(meta.after)}</td>
                    <td>
                      {resend ? meta.stripeSubscriptionId : moved.length > 0 ? (
                        <details className="history-moved">
                          <summary>{moved.length === 1 ? '1 assinatura remarcada' : `${moved.length} assinaturas remarcadas`}</summary>
                          <ul className="plain-list">
                            {moved.map((entry) => (
                              <li key={`${entry.stripeSubscriptionId}-${entry.deliveryId}`}>
                                {entry.stripeSubscriptionId}: {formatDay(entry.previousPreparationDay)} → {formatDay(entry.newPreparationDay)} · {MOVE_LABELS[entry.move]}
                                {entry.pendingTrialEnd ? ` (${formatDate(entry.pendingTrialEnd.previous, timeZone)} → ${formatDate(entry.pendingTrialEnd.next, timeZone)})` : ''}
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <Pager
          page={current}
          totalPages={totalPages}
          onPrev={() => setPage(current - 1)}
          onNext={() => setPage(current + 1)}
        />
      ) : null}
    </>
  )
}
