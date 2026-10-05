import { Fragment, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { MetricCard } from '../components/MetricCard'
import { Pager } from '../components/Pager'
import { FiltersBar } from '../components/FiltersBar'
import { Dialog } from '../components/Dialog'
import { AccountSelect } from '../components/MarketSelect'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import { formatDate, formatStripeStatus, formatTermMonths, getBrowserTimeZone } from '../lib/format'
import { defaultStripeAccount, hasBothMarkets, isProfileInScope } from '../lib/markets'

type ProductionStatus = 'to_prepare' | 'in_production' | 'ready' | 'blocked'
type DueBucket = 'overdue' | 'today' | 'tomorrow' | 'upcoming'

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

const STATUS_LABELS: Record<ProductionStatus, string> = {
  to_prepare: 'A preparar',
  in_production: 'Em produção',
  ready: 'Pronto',
  blocked: 'Bloqueado',
}

const STATUS_BADGE: Record<ProductionStatus, string> = {
  to_prepare: 'badge-info',
  in_production: 'badge-warning',
  ready: 'badge-success',
  blocked: 'badge-error',
}

const DUE_BADGE: Record<DueBucket, string> = {
  overdue: 'badge-error',
  today: 'badge-warning',
  tomorrow: 'badge-info',
  upcoming: 'badge-info',
}

const BUCKET_HEADERS: Record<DueBucket, string> = {
  overdue: 'Atrasados',
  today: 'Vence hoje',
  tomorrow: 'Amanhã',
  upcoming: 'Próximos',
}

function nextActions(item: QueueItem) {
  const actions = NEXT_ACTIONS[item.productionStatus] || []
  const paid = !item.paymentState || item.paymentState === 'paid'
  return paid ? actions : actions.filter((action) => action.status !== 'in_production')
}

const NEXT_ACTIONS: Record<ProductionStatus, Array<{ status: ProductionStatus; label: string }>> = {
  to_prepare: [
    { status: 'in_production', label: 'Em produção' },
    { status: 'blocked', label: 'Bloquear' },
  ],
  in_production: [
    { status: 'ready', label: 'Pronto' },
    { status: 'blocked', label: 'Bloquear' },
  ],
  ready: [{ status: 'in_production', label: 'Reabrir' }],
  blocked: [{ status: 'to_prepare', label: 'Reabrir' }],
}

function FilterClearButton({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button type="button" className="filter-clear" aria-label={label} onClick={onClear}>
      ×
    </button>
  )
}

function TableSkeleton() {
  return (
    <div className="table-shell table-scroll table-skeleton" aria-busy="true">
      <table>
        <thead>
          <tr>
            <th>Vencimento</th>
            <th>Cliente</th>
            <th>Pets + mix</th>
            <th>Packs</th>
            <th>Plano</th>
            <th>País / cidade</th>
            <th>Pagamento</th>
            <th>Produção</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }, (_, index) => (
            <tr key={index}>
              {Array.from({ length: 9 }, (__, cell) => (
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
  const [data, setData] = useState<QueueResponse | null>(null)
  const [windowDays, setWindowDays] = useState(7)
  const [pickedAccount, setPickedAccount] = useState('')
  const [productionStatus, setProductionStatus] = useState('')
  const [search, setSearch] = useState('')
  const [includeOverdue, setIncludeOverdue] = useState(true)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [blockItem, setBlockItem] = useState<QueueItem | null>(null)
  const [blockNote, setBlockNote] = useState('')
  const [denseItem, setDenseItem] = useState<QueueItem | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const account = bothMarkets ? pickedAccount : (defaultStripeAccount(user) ?? '')

  const load = async () => {
    if (!token || !user) return
    setError('')
    setLoading(true)
    try {
      const response = await apiRequest<QueueResponse>(`/admin/production/queue${buildQueryString({
        windowDays,
        includeOverdue,
        account: account || undefined,
        productionStatus: productionStatus || undefined,
        q: search || undefined,
        timezone: getBrowserTimeZone(),
        page,
        perPage,
      })}`, { token })
      setData(response)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar a fila de produção')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [token, user, windowDays, account, productionStatus, search, includeOverdue, page, perPage])

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
      await load()
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

  const clearFilters = () => {
    setWindowDays(7)
    setPickedAccount(bothMarkets ? '' : (defaultStripeAccount(user) ?? ''))
    setProductionStatus('')
    setSearch('')
    setIncludeOverdue(true)
    setPage(1)
  }

  let lastBucket: DueBucket | null = null

  return (
    <PageFrame title="Produção" description="Fila da cozinha pelas renovações Stripe da janela civil selecionada.">
      <div className="grid cards-4">
        <MetricCard label="Vence hoje" value={data?.metrics.today ?? '—'} />
        <MetricCard label="Amanhã" value={data?.metrics.tomorrow ?? '—'} />
        <MetricCard label={`Próximos ${windowDays}d`} value={data?.metrics.upcoming ?? '—'} />
        <MetricCard label="Atrasados" value={data?.metrics.overdue ?? '—'} />
      </div>

      <Section title="Filtros" description="A busca e o status de produção recortam a grade, não os indicadores.">
        <FiltersBar>
          <label>
            Janela
            <select
              aria-label="Janela"
              value={windowDays}
              onChange={(event) => { setWindowDays(Number(event.target.value)); setPage(1) }}
            >
              <option value={7}>7 dias</option>
              <option value={14}>14 dias</option>
              <option value={30}>30 dias</option>
            </select>
          </label>
          <AccountSelect
            user={user}
            includeAll
            value={account || 'all'}
            onChange={(value) => { setPickedAccount(value === 'all' ? '' : value); setPage(1) }}
          />
          <label>
            Produção
            <span className="filter-field">
              <select
                aria-label="Status de produção"
                value={productionStatus}
                onChange={(event) => { setProductionStatus(event.target.value); setPage(1) }}
              >
                <option value="">Todos</option>
                <option value="to_prepare">A preparar</option>
                <option value="in_production">Em produção</option>
                <option value="ready">Pronto</option>
                <option value="blocked">Bloqueado</option>
              </select>
              {productionStatus ? (
                <FilterClearButton label="Limpar status de produção" onClear={() => { setProductionStatus(''); setPage(1) }} />
              ) : null}
            </span>
          </label>
          <label>
            Busca
            <span className="filter-field">
              <input
                aria-label="Busca"
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1) }}
                placeholder="e-mail, sub_, cus_ ou user id"
              />
              {search ? (
                <FilterClearButton label="Limpar busca" onClear={() => { setSearch(''); setPage(1) }} />
              ) : null}
            </span>
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={includeOverdue}
              onChange={(event) => { setIncludeOverdue(event.target.checked); setPage(1) }}
            />
            Incluir atrasados
          </label>
          <button className="ghost-button" type="button" onClick={clearFilters}>Limpar</button>
        </FiltersBar>
      </Section>

      {error ? <div className="alert">{error}</div> : null}

      <Section title="Fila" description={`Total: ${data?.total ?? '—'}`}>
        {loading ? <TableSkeleton /> : (
          <div className="table-shell table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Vencimento</th>
                  <th>Cliente</th>
                  <th>Pets + mix</th>
                  <th>Packs</th>
                  <th>Plano</th>
                  <th>País / cidade</th>
                  <th>Pagamento</th>
                  <th>Produção</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={9}>Nenhuma renovação nesta janela.</td>
                  </tr>
                ) : data?.items.map((item) => {
                  const showHeader = item.dueBucket && item.dueBucket !== lastBucket
                  if (item.dueBucket) {
                    lastBucket = item.dueBucket
                  }
                  return (
                    <Fragment key={`${item.id}-${item.currentPeriodEnd}`}>
                      {showHeader && item.dueBucket ? (
                        <tr className="table-section-row">
                          <td colSpan={9}>{BUCKET_HEADERS[item.dueBucket]}</td>
                        </tr>
                      ) : null}
                      <tr>
                        <td>
                          <div>{formatDate(item.preparationDay || item.currentPeriodEnd)}</div>
                          {item.dueBucket ? (
                            <span className={DUE_BADGE[item.dueBucket]}>{item.dueLabel}</span>
                          ) : null}
                        </td>
                        <td>
                          <div>{item.customerName || item.email}</div>
                          {item.customerName ? <div className="muted">{item.email}</div> : null}
                        </td>
                        <td>
                          {item.flavorMix || '—'}
                          {item.dense ? (
                            <div>
                              <button className="table-link" type="button" onClick={() => setDenseItem(item)}>
                                Ver mix
                              </button>
                            </div>
                          ) : null}
                        </td>
                        <td>{item.packCount} · {item.packSizeLabel || '—'}</td>
                        <td>
                          {item.planLabel || '—'}
                          {item.termMonths ? <div className="muted">{formatTermMonths(item.termMonths)}</div> : null}
                          {item.subtotal == null ? <div className="muted">Subtotal —</div> : null}
                        </td>
                        <td>{[item.country, item.city].filter(Boolean).join(' / ') || '—'}</td>
                        <td>{formatStripeStatus(item.stripeStatus)}</td>
                        <td>
                          <span className={STATUS_BADGE[item.productionStatus]}>{STATUS_LABELS[item.productionStatus]}</span>
                          {item.paymentLabel ? (
                            <div><span className={item.paymentState === 'past_due' ? 'badge-error' : 'badge-warning'}>{item.paymentLabel}</span></div>
                          ) : null}
                          {item.note ? <div className="muted">{item.note}</div> : null}
                        </td>
                        <td>
                          <div className="table-actions">
                            {canWrite ? nextActions(item).map((action) => (
                              <button
                                key={action.status}
                                className="ghost-button"
                                type="button"
                                disabled={busyId === `${item.id}-${item.currentPeriodEnd}`}
                                onClick={() => requestStatus(item, action.status)}
                              >
                                {action.label}
                              </button>
                            )) : null}
                            {isProfileInScope(item.customerProfileInScope) ? (
                              <>
                                <Link className="table-link" to={`/users/${item.userId}`}>Cliente</Link>
                                <Link className="table-link" to={`/billing/subscriptions/${item.id}`}>Assinante</Link>
                                <Link className="table-link" to={`/onboarding/sessions/${item.userId}`}>Onboarding 360</Link>
                              </>
                            ) : (
                              <>
                                <span>Cliente</span>
                                <span>Assinante</span>
                                <span>Onboarding 360</span>
                              </>
                            )}
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
        <Pager
          page={data?.page ?? page}
          totalPages={data?.totalPages ?? 1}
          onPrev={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => current + 1)}
        />
      </Section>

      <Dialog
        title="Bloquear ciclo"
        description="A nota é obrigatória e fica visível na fila."
        open={Boolean(blockItem)}
        onClose={() => { setBlockItem(null); setBlockNote('') }}
        footer={(
          <>
            <button className="ghost-button" type="button" onClick={() => { setBlockItem(null); setBlockNote('') }}>
              Cancelar
            </button>
            <button
              className="primary-button"
              type="submit"
              form="production-block-form"
              disabled={blockNote.trim().length < 1 || blockNote.trim().length > 255}
            >
              Bloquear
            </button>
          </>
        )}
      >
        <form id="production-block-form" onSubmit={submitBlock}>
          <label>
            Nota
            <textarea
              required
              minLength={1}
              maxLength={255}
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
