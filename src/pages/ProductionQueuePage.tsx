import { Fragment, useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Pager } from '../components/Pager'
import { Dialog } from '../components/Dialog'
import { RowMenu, type RowMenuItem } from '../components/RowMenu'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import { getBrowserTimeZone } from '../lib/format'
import { defaultStripeAccount, hasBothMarkets, isProfileInScope } from '../lib/markets'
import {
  DUE_LABELS,
  DUE_TO_API,
  PRODUCTION_STATUS_LABELS,
  PRODUCTION_STATUSES,
  isProductionStatus,
  isQueueDue,
  plural,
  type DueBucket,
  type ProductionStatus,
  type QueueDue,
} from '../lib/productionQueue'

type LineItem = {
  flavor: string
  quantity: number
  packSize: string
  petName: string | null
}

type QueueItem = {
  id: number
  userId: string
  stripeSubscriptionId: string
  currentPeriodEnd: string | null
  daysUntil: number | null
  dueBucket: DueBucket | null
  dueLabel: string
  displayName: string
  customerName?: string | null
  email: string
  flavorMix: string
  packCount: number
  packSizeLabel: string
  planLabel: string | null
  termMonths: number | null
  country: string
  city: string
  stripeStatus: string
  productionStatus: ProductionStatus
  // A cycle is produced only after its invoice is paid; a past_due cycle waits for the late payment.
  paymentState?: 'awaiting_payment' | 'past_due' | 'paid'
  paymentLabel?: string | null
  preparationDay?: string | null
  note: string | null
  subtotal: number | null
  currency: string | null
  stripeAccount: string
  dense: boolean
  customerProfileInScope?: boolean
  lineItems: LineItem[]
}

type QueueResponse = {
  total: number
  page: number
  perPage: number
  totalPages: number
  metrics: { today: number; tomorrow: number; upcoming: number; overdue: number }
  items: QueueItem[]
}

const PER_PAGE = 20
const WINDOWS = [7, 14, 30]

const STATUS_BADGE: Record<ProductionStatus, string> = {
  to_prepare: 'badge-neutral',
  in_production: 'badge-info',
  ready: 'badge-success',
  blocked: 'badge-error',
}

const BUCKET_HEADERS: Record<DueBucket, string> = {
  overdue: 'Atrasados',
  today: 'Hoje',
  tomorrow: 'Amanhã',
  upcoming: 'Próximos dias',
}

// The forward step of each status: the one button a row shows.
const PRIMARY_ACTION: Partial<Record<ProductionStatus, { status: ProductionStatus; label: string }>> = {
  to_prepare: { status: 'in_production', label: 'Iniciar preparo' },
  in_production: { status: 'ready', label: 'Marcar como pronto' },
  blocked: { status: 'to_prepare', label: 'Reabrir' },
}

function isPaid(item: QueueItem) {
  return !item.paymentState || item.paymentState === 'paid'
}

function civilDay(item: QueueItem) {
  if (item.preparationDay) return item.preparationDay
  if (!item.currentPeriodEnd) return null
  const date = new Date(item.currentPeriodEnd)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-CA', { timeZone: getBrowserTimeZone() }).format(date)
}

function dayDate(isoDay: string) {
  const [year, month, day] = isoDay.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function shortDay(isoDay: string | null) {
  if (!isoDay) return '—'
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).format(dayDate(isoDay))
}

function longDay(isoDay: string) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(dayDate(isoDay))
}

function bucketHeader(bucket: DueBucket, item: QueueItem) {
  const day = civilDay(item)
  return (bucket === 'today' || bucket === 'tomorrow') && day ? `${BUCKET_HEADERS[bucket]} · ${longDay(day)}` : BUCKET_HEADERS[bucket]
}

function TableSkeleton() {
  return (
    <div className="queue-table-shell table-skeleton" aria-busy="true">
      <table className="queue-table">
        <tbody>
          {Array.from({ length: 5 }, (_, index) => (
            <tr key={index}>
              {Array.from({ length: 6 }, (__, cell) => (
                <td key={cell}><span className="skeleton-bar" /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ProductionQueuePage() {
  const { token, user, hasPermission } = useAuth()
  const canWrite = hasPermission('production.write')
  const bothMarkets = hasBothMarkets(user)
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState<QueueResponse | null>(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [blockItem, setBlockItem] = useState<QueueItem | null>(null)
  const [blockNote, setBlockNote] = useState('')
  const [denseItem, setDenseItem] = useState<QueueItem | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const rawDue = params.get('prazo')
  const due: QueueDue | '' = isQueueDue(rawDue) ? rawDue : ''
  const rawStatus = params.get('status')
  const productionStatus: ProductionStatus | '' = isProductionStatus(rawStatus) ? rawStatus : ''
  const search = params.get('busca') ?? ''
  const windowDays = WINDOWS.includes(Number(params.get('periodo'))) ? Number(params.get('periodo')) : 7
  const pickedMarket = params.get('mercado')
  const account = bothMarkets
    ? (pickedMarket === 'br' || pickedMarket === 'us' ? pickedMarket : '')
    : (defaultStripeAccount(user) ?? '')

  const setFilter = (key: 'prazo' | 'status' | 'busca' | 'periodo' | 'mercado', value: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    }, { replace: true })
    setPage(1)
  }

  const clearFilters = () => {
    setParams(new URLSearchParams(), { replace: true })
    setPage(1)
  }

  const [reloadKey, setReloadKey] = useState(0)
  const [loadedKey, setLoadedKey] = useState('')
  const requestPath = `/admin/production/queue${buildQueryString({
    windowDays,
    includeOverdue: true,
    due: due ? DUE_TO_API[due] : undefined,
    account: account || undefined,
    productionStatus: productionStatus || undefined,
    q: search || undefined,
    timezone: getBrowserTimeZone(),
    page,
    perPage: PER_PAGE,
  })}`
  const requestKey = `${requestPath}#${reloadKey}`
  const loading = loadedKey !== requestKey

  useEffect(() => {
    if (!token || !user) return undefined
    let cancelled = false
    void (async () => {
      try {
        const response = await apiRequest<QueueResponse>(requestPath, { token })
        if (cancelled) return
        setData(response)
        setError('')
      } catch (requestError) {
        if (cancelled) return
        setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar a fila de produção')
        setData(null)
      } finally {
        if (!cancelled) setLoadedKey(requestKey)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, user, requestPath, requestKey])

  const patchStatus = async (item: QueueItem, status: ProductionStatus, note?: string) => {
    if (!token || !canWrite || !item.currentPeriodEnd) return
    setBusyId(`${item.id}-${item.currentPeriodEnd}`)
    setError('')
    try {
      await apiRequest(`/admin/production/queue/${item.id}`, {
        token,
        method: 'PATCH',
        body: {
          status,
          periodEnd: item.currentPeriodEnd,
          note: note || undefined,
        },
      })
      setBlockItem(null)
      setBlockNote('')
      setReloadKey((key) => key + 1)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao atualizar o status de produção')
    } finally {
      setBusyId(null)
    }
  }

  const requestStatus = (item: QueueItem, status: ProductionStatus) => {
    if (status === 'blocked') {
      setBlockNote(item.note || '')
      setBlockItem(item)
      return
    }
    void patchStatus(item, status)
  }

  const submitBlock = (event: FormEvent) => {
    event.preventDefault()
    if (!blockItem) return
    const note = blockNote.trim()
    if (note.length < 1 || note.length > 255) return
    void patchStatus(blockItem, 'blocked', note)
  }

  const metrics = data?.metrics
  const dueCards: Array<{ id: QueueDue; label: string; value: number | undefined; tone?: string }> = [
    { id: 'atrasados', label: 'Atrasados', value: metrics?.overdue, tone: metrics && metrics.overdue > 0 ? 'queue-due-danger' : undefined },
    { id: 'hoje', label: 'Hoje', value: metrics?.today },
    { id: 'amanha', label: 'Amanhã', value: metrics?.tomorrow },
    { id: 'proximos', label: `Próximos ${windowDays} dias`, value: metrics?.upcoming },
  ]

  const chips: Array<{ key: 'prazo' | 'status' | 'busca' | 'mercado'; text: string }> = []
  if (due) chips.push({ key: 'prazo', text: `Prazo: ${DUE_LABELS[due]}` })
  if (productionStatus) chips.push({ key: 'status', text: `Preparo: ${PRODUCTION_STATUS_LABELS[productionStatus]}` })
  if (search) chips.push({ key: 'busca', text: `Busca: “${search}”` })
  if (bothMarkets && account) chips.push({ key: 'mercado', text: `Mercado: ${account === 'us' ? 'EUA' : 'Brasil'}` })
  const filtering = chips.length > 0 || windowDays !== 7

  // Where to look first, then what changes the order; the destructive step goes last.
  const menuItems = (item: QueueItem): RowMenuItem[] => {
    const entries: RowMenuItem[] = isProfileInScope(item.customerProfileInScope)
      ? [
        { label: 'Cliente', to: `/users/${item.userId}` },
        { label: 'Assinatura', to: `/billing/subscriptions/${item.id}` },
        { label: 'Onboarding 360', to: `/onboarding/sessions/${item.userId}` },
      ]
      : [{ label: 'Perfil fora do seu mercado', disabled: true }]
    if (canWrite && item.productionStatus === 'ready') {
      entries.push({ label: 'Reabrir', onSelect: () => requestStatus(item, 'in_production') })
    }
    if (canWrite && (item.productionStatus === 'to_prepare' || item.productionStatus === 'in_production')) {
      entries.push({ label: 'Bloquear', onSelect: () => requestStatus(item, 'blocked'), danger: true })
    }
    return entries
  }

  let lastBucket: DueBucket | null = null
  const total = data?.total ?? 0

  return (
    <PageFrame
      title="Fila de produção"
      description="Pedidos pagos, na ordem de preparo. Marque o andamento de cada um aqui."
      actions={<Link className="ghost-button" to="/dashboard">← Voltar para Hoje</Link>}
    >
      <div className="queue-due" role="group" aria-label="Filtrar por prazo">
        {dueCards.map((card) => (
          <button
            key={card.id}
            type="button"
            aria-pressed={due === card.id}
            className={['queue-due-card', due === card.id ? 'active' : '', card.tone ?? ''].filter(Boolean).join(' ')}
            onClick={() => setFilter('prazo', due === card.id ? '' : card.id)}
          >
            <span className="queue-due-label">{card.label}</span>
            <strong className="queue-due-value">{card.value ?? '—'}</strong>
          </button>
        ))}
      </div>

      <div className="queue-filters">
        <label className="queue-field queue-field-grow">
          Buscar
          <input
            type="search"
            aria-label="Buscar"
            value={search}
            onChange={(event) => setFilter('busca', event.target.value)}
            placeholder="E-mail do cliente"
          />
        </label>
        <label className="queue-field">
          Período
          <select aria-label="Período" value={windowDays} onChange={(event) => setFilter('periodo', event.target.value === '7' ? '' : event.target.value)}>
            {WINDOWS.map((days) => <option key={days} value={days}>Próximos {days} dias</option>)}
          </select>
        </label>
        <label className="queue-field">
          Preparo
          <select aria-label="Preparo" value={productionStatus} onChange={(event) => setFilter('status', event.target.value)}>
            <option value="">Todos</option>
            {PRODUCTION_STATUSES.map((status) => <option key={status} value={status}>{PRODUCTION_STATUS_LABELS[status]}</option>)}
          </select>
        </label>
        {bothMarkets ? (
          <div className="queue-field">
            <span id="queue-market-label">Mercado</span>
            <div className="segmented" role="group" aria-labelledby="queue-market-label">
              {([['', 'Todos'], ['br', 'Brasil'], ['us', 'EUA']] as const).map(([value, label]) => (
                <button key={label} type="button" aria-pressed={account === value} className={account === value ? 'active' : ''} onClick={() => setFilter('mercado', value)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="queue-summary">
        <div className="queue-summary-main" aria-live="polite">
          <strong>{data ? plural(total, 'pedido', 'pedidos') : '—'}</strong>
          {chips.length > 0 ? <span className="muted">com o filtro</span> : null}
          {chips.map((chip) => (
            <span key={chip.key} className="filter-chip">
              {chip.text}
              <button type="button" aria-label={`Remover filtro ${chip.text}`} onClick={() => setFilter(chip.key, '')}>×</button>
            </span>
          ))}
        </div>
        {filtering ? <button type="button" className="link-button" onClick={clearFilters}>Limpar filtros</button> : null}
      </div>

      {error ? <div className="alert" role="alert">{error}</div> : null}

      {loading && !data ? <TableSkeleton /> : (
        <div className="queue-table-shell" aria-busy={loading}>
          <table className="queue-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Dia de preparo</th>
                <th>Sabores</th>
                <th>Preparo</th>
                <th>Pagamento</th>
                <th className="queue-actions-head">Ação</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={6} className="queue-empty">
                    {filtering ? (
                      <>
                        Nenhum pedido com estes filtros.{' '}
                        <button type="button" className="link-button" onClick={clearFilters}>Limpar filtros</button>
                      </>
                    ) : `Nenhum pedido para preparar nos próximos ${windowDays} dias.`}
                  </td>
                </tr>
              ) : data?.items.map((item) => {
                const showHeader = item.dueBucket && item.dueBucket !== lastBucket
                if (item.dueBucket) lastBucket = item.dueBucket
                const primary = PRIMARY_ACTION[item.productionStatus]
                const canStart = primary && (primary.status !== 'in_production' || isPaid(item))
                const busy = busyId === `${item.id}-${item.currentPeriodEnd}`
                const name = item.customerName || item.email
                return (
                  <Fragment key={`${item.id}-${item.currentPeriodEnd}`}>
                    {showHeader && item.dueBucket ? (
                      <tr className="queue-group-row">
                        <td colSpan={6}>{bucketHeader(item.dueBucket, item)}</td>
                      </tr>
                    ) : null}
                    <tr>
                      <td className="queue-cell-customer">
                        <div className="queue-cell-stack">
                          <strong>{name}</strong>
                          {item.customerName ? <span className="muted">{item.email}</span> : null}
                          <span className="muted">{[item.country, item.city].filter(Boolean).join(' · ') || '—'}</span>
                        </div>
                      </td>
                      <td className="nowrap" data-label="Dia de preparo">
                        <div className="queue-cell-stack">
                          <span>{shortDay(civilDay(item))}</span>
                          {item.dueBucket === 'overdue' ? <span className="badge-error">{item.dueLabel}</span> : null}
                        </div>
                      </td>
                      <td data-label="Sabores">
                        <div className="queue-cell-stack">
                          <span>{item.flavorMix || '—'}</span>
                          <span className="muted">
                            {plural(item.packCount, 'pacote', 'pacotes')}{item.packSizeLabel ? ` · ${item.packSizeLabel}` : ''}
                          </span>
                          {item.dense ? (
                            <button className="link-button" type="button" onClick={() => setDenseItem(item)}>Ver mix</button>
                          ) : null}
                        </div>
                      </td>
                      <td data-label="Preparo">
                        <div className="queue-cell-stack">
                          <span className={STATUS_BADGE[item.productionStatus]}>{PRODUCTION_STATUS_LABELS[item.productionStatus]}</span>
                          {item.note ? <span className="muted queue-note">{item.note}</span> : null}
                        </div>
                      </td>
                      <td className="nowrap" data-label="Pagamento">
                        {isPaid(item) ? (
                          <span className="queue-paid">Pago</span>
                        ) : (
                          <span className={item.paymentState === 'past_due' ? 'badge-error' : 'badge-warning'}>
                            {item.paymentLabel || (item.paymentState === 'past_due' ? 'Pagamento recusado' : 'Aguardando pagamento')}
                          </span>
                        )}
                      </td>
                      <td className="queue-cell-actions">
                        <div className="queue-actions">
                          {canWrite && primary && canStart ? (
                            <button
                              className={item.productionStatus === 'blocked' ? 'ghost-button' : 'primary-button'}
                              type="button"
                              disabled={busy}
                              onClick={() => requestStatus(item, primary.status)}
                            >
                              {primary.label}
                            </button>
                          ) : item.productionStatus === 'ready' ? (
                            <span className="muted">Concluído</span>
                          ) : null}
                          <RowMenu label={`Mais opções para ${name}`} items={menuItems(item)} />
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && data.totalPages > 1 ? (
        <Pager
          page={data.page}
          totalPages={data.totalPages}
          onPrev={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => current + 1)}
        />
      ) : null}

      <Dialog
        title="Bloquear pedido"
        description="Diga o que impede o preparo. A nota fica visível na fila."
        open={Boolean(blockItem)}
        onClose={() => { setBlockItem(null); setBlockNote('') }}
        footer={(
          <>
            <button className="ghost-button" type="button" onClick={() => { setBlockItem(null); setBlockNote('') }}>
              Cancelar
            </button>
            <button
              className="danger-button"
              type="submit"
              form="production-block-form"
              disabled={blockNote.trim().length < 1 || blockNote.trim().length > 255}
            >
              Bloquear
            </button>
          </>
        )}
      >
        <form id="production-block-form" className="closure-form" onSubmit={submitBlock}>
          {blockItem ? (
            <p className="closure-context"><strong>{blockItem.customerName || blockItem.email}</strong> · {blockItem.flavorMix || '—'}</p>
          ) : null}
          <label className="closure-field">
            Nota
            <textarea
              required
              minLength={1}
              maxLength={255}
              rows={3}
              value={blockNote}
              onChange={(event) => setBlockNote(event.target.value)}
            />
          </label>
        </form>
      </Dialog>

      <Dialog
        title="Mix de sabores"
        open={Boolean(denseItem)}
        onClose={() => setDenseItem(null)}
      >
        <ul className="plain-list">
          {(denseItem?.lineItems || []).map((line) => (
            <li key={`${line.flavor}-${line.packSize}-${line.petName}`}>
              {line.flavor} × {line.quantity} · {line.packSize || '—'}
              {line.petName ? ` · ${line.petName}` : ''}
            </li>
          ))}
        </ul>
      </Dialog>
    </PageFrame>
  )
}
