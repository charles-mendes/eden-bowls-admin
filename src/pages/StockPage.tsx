import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Dialog } from '../components/Dialog'
import { FiltersBar } from '../components/FiltersBar'
import { MarketSelect } from '../components/MarketSelect'
import { PageFrame } from '../components/PageFrame'
import { Pager } from '../components/Pager'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import { formatDate } from '../lib/format'
import { defaultMarket, hasBothMarkets } from '../lib/markets'
import {
  ADJUSTMENT_REASON_LABELS,
  MOVEMENT_TYPE_LABELS,
  STOCK_WINDOWS,
  isStockWindow,
  sortStockItems,
  stockErrorMessage,
  stockItemLabel,
  type StockAdjustmentReason,
  type StockItem,
  type StockMovement,
  type StockMovementType,
  type StockMovementsResponse,
  type StockOverview,
} from '../lib/packStock'

type ProductionForm = { flavorKey: string; packSizeGrams: string; quantity: string; note: string }
type AdjustmentForm = { quantity: string; reason: StockAdjustmentReason; note: string }
type MinimumForm = { minLevel: string }

const EMPTY_PRODUCTION: ProductionForm = { flavorKey: '', packSizeGrams: '', quantity: '', note: '' }
const EMPTY_ADJUSTMENT: AdjustmentForm = { quantity: '', reason: 'loss', note: '' }
const PER_PAGE = 20

function highlighted(item: StockItem) {
  return item.available < 0 || item.belowMinimum
}

export function StockPage() {
  const { token, user, hasPermission } = useAuth()
  const canWrite = hasPermission('production.write')
  const bothMarkets = hasBothMarkets(user)
  const lockedMarket = defaultMarket(user) ?? 'BR'

  const [market, setMarket] = useState(lockedMarket)
  const [windowDays, setWindowDays] = useState(7)
  const [overview, setOverview] = useState<StockOverview | null>(null)
  const [movements, setMovements] = useState<StockMovementsResponse | null>(null)
  const [page, setPage] = useState(1)
  const [filterItem, setFilterItem] = useState<StockItem | null>(null)
  const [filterType, setFilterType] = useState<StockMovementType | ''>('')
  const [error, setError] = useState('')
  const [dialogError, setDialogError] = useState('')
  const [productionOpen, setProductionOpen] = useState(false)
  const [production, setProduction] = useState(EMPTY_PRODUCTION)
  const [adjustItem, setAdjustItem] = useState<StockItem | null>(null)
  const [adjustment, setAdjustment] = useState(EMPTY_ADJUSTMENT)
  const [minimumItem, setMinimumItem] = useState<StockItem | null>(null)
  const [minimum, setMinimum] = useState<MinimumForm>({ minLevel: '' })
  const [reloadKey, setReloadKey] = useState(0)

  const scopedMarket = bothMarkets ? market : lockedMarket

  useEffect(() => {
    if (!token || !user) return undefined
    let cancelled = false
    void (async () => {
      try {
        const response = await apiRequest<StockOverview>(`/admin/stock${buildQueryString({
          market: scopedMarket,
          windowDays,
        })}`, { token })
        if (!cancelled) {
          setOverview(response)
          setError('')
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar o estoque')
          setOverview(null)
        }
      }
    })()
    return () => { cancelled = true }
  }, [token, user, scopedMarket, windowDays, reloadKey])

  useEffect(() => {
    if (!token || !user) return undefined
    let cancelled = false
    void (async () => {
      try {
        const response = await apiRequest<StockMovementsResponse>(`/admin/stock/movements${buildQueryString({
          market: scopedMarket,
          flavorKey: filterItem?.flavorKey,
          packSizeGrams: filterItem?.packSizeGrams,
          type: filterType || undefined,
          page,
          perPage: PER_PAGE,
        })}`, { token })
        if (!cancelled) setMovements(response)
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar o histórico')
        }
      }
    })()
    return () => { cancelled = true }
  }, [token, user, scopedMarket, filterItem, filterType, page, reloadKey])

  const closeDialogs = () => {
    setProductionOpen(false)
    setProduction(EMPTY_PRODUCTION)
    setAdjustItem(null)
    setAdjustment(EMPTY_ADJUSTMENT)
    setMinimumItem(null)
    setMinimum({ minLevel: '' })
    setDialogError('')
  }

  const submitProduction = async (event: FormEvent) => {
    event.preventDefault()
    if (!token) return
    setDialogError('')
    try {
      await apiRequest('/admin/stock/production', {
        token,
        method: 'POST',
        body: {
          market: scopedMarket,
          flavorKey: production.flavorKey.trim(),
          packSizeGrams: Number(production.packSizeGrams),
          quantity: Number(production.quantity),
          note: production.note.trim() || undefined,
        },
      })
      closeDialogs()
      setReloadKey((key) => key + 1)
    } catch (requestError) {
      setDialogError(stockErrorMessage(requestError))
    }
  }

  const submitAdjustment = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !adjustItem) return
    setDialogError('')
    try {
      await apiRequest('/admin/stock/adjustments', {
        token,
        method: 'POST',
        body: {
          market: scopedMarket,
          flavorKey: adjustItem.flavorKey,
          packSizeGrams: adjustItem.packSizeGrams,
          quantity: Number(adjustment.quantity),
          reason: adjustment.reason,
          note: adjustment.note.trim() || undefined,
        },
      })
      closeDialogs()
      setReloadKey((key) => key + 1)
    } catch (requestError) {
      setDialogError(stockErrorMessage(requestError))
    }
  }

  const submitMinimum = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !minimumItem) return
    setDialogError('')
    try {
      await apiRequest('/admin/stock/minimum', {
        token,
        method: 'PUT',
        body: {
          market: scopedMarket,
          flavorKey: minimumItem.flavorKey,
          packSizeGrams: minimumItem.packSizeGrams,
          minLevel: minimum.minLevel.trim() === '' ? null : Number(minimum.minLevel),
        },
      })
      closeDialogs()
      setReloadKey((key) => key + 1)
    } catch (requestError) {
      setDialogError(stockErrorMessage(requestError))
    }
  }

  const items = sortStockItems(overview?.items ?? [])
  const unsized = overview?.unsizedLines ?? []
  const unsizedTotal = unsized.reduce((sum, line) => sum + line.quantity, 0)

  return (
    <PageFrame
      title="Estoque"
      description="Packs prontos contra as entregas da janela. A cozinha lança produção e ajustes aqui."
      actions={canWrite ? (
        <button className="primary-button" type="button" onClick={() => { setDialogError(''); setProductionOpen(true) }}>
          Lançar produção
        </button>
      ) : null}
    >
      {error ? <div className="alert" role="alert">{error}</div> : null}

      {unsized.length > 0 ? (
        <div className="alert" role="status">
          {unsizedTotal} packs sem tamanho não entram no comprometido
          {' '}
          {unsized.map((line) => (
            <Link
              key={`${line.subscriptionId}-${line.label}`}
              className="table-link"
              to={`/billing/subscriptions/${line.subscriptionId}`}
            >
              {line.label || line.flavorKey || 'pack'} × {line.quantity}
            </Link>
          ))}
        </div>
      ) : null}

      <Section title="Filtros">
        <FiltersBar>
          <label>
            Janela
            <select
              aria-label="Janela"
              value={windowDays}
              onChange={(event) => setWindowDays(isStockWindow(Number(event.target.value)) ? Number(event.target.value) : 7)}
            >
              {STOCK_WINDOWS.map((days) => <option key={days} value={days}>{days} dias</option>)}
            </select>
          </label>
          <MarketSelect
            user={user}
            value={scopedMarket}
            onChange={(value) => setMarket((value || lockedMarket) as typeof lockedMarket)}
          />
        </FiltersBar>
      </Section>

      <Section title="Packs" description={`Total: ${overview ? items.length : '—'}`}>
        <div className="table-shell table-scroll">
          <table>
            <thead>
              <tr>
                <th>Receita</th>
                <th>Tamanho</th>
                <th>Em estoque</th>
                <th>Comprometido</th>
                <th>Disponível</th>
                <th>A produzir</th>
                <th>Mínimo</th>
                {canWrite ? <th>Ações</th> : null}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={canWrite ? 8 : 7}>Nenhum item de estoque nem entrega nesta janela.</td>
                </tr>
              ) : items.map((item) => (
                <tr
                  key={`${item.flavorKey}|${item.packSizeGrams}`}
                  className={highlighted(item) ? 'stock-row-warning' : undefined}
                  onClick={() => { setFilterItem(item); setPage(1) }}
                >
                  <td>{item.flavorKey}</td>
                  <td>{item.packSizeGrams} g</td>
                  <td>{item.onHand}</td>
                  <td>
                    <div className="queue-cell-stack">
                      <span>{item.committed}</span>
                      {item.committedAwaitingPayment > 0 ? (
                        <span className="muted">{item.committedAwaitingPayment} aguardando pagamento</span>
                      ) : null}
                    </div>
                  </td>
                  <td>{item.available}</td>
                  <td>{item.toProduce}</td>
                  <td>{item.minLevel ?? '—'}</td>
                  {canWrite ? (
                    <td>
                      <button className="link-button" type="button" onClick={(event) => { event.stopPropagation(); setDialogError(''); setAdjustItem(item); setAdjustment(EMPTY_ADJUSTMENT) }}>
                        Ajustar
                      </button>
                      {' '}
                      <button className="link-button" type="button" onClick={(event) => { event.stopPropagation(); setDialogError(''); setMinimumItem(item); setMinimum({ minLevel: item.minLevel == null ? '' : String(item.minLevel) }) }}>
                        Definir mínimo
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Histórico" description={filterItem ? stockItemLabel(filterItem.flavorKey, filterItem.packSizeGrams) : 'Todos os itens'}>
        <FiltersBar>
          <label>
            Tipo
            <select
              aria-label="Tipo de movimento"
              value={filterType}
              onChange={(event) => { setFilterType(event.target.value as StockMovementType | ''); setPage(1) }}
            >
              <option value="">Todos</option>
              {Object.entries(MOVEMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          {filterItem ? (
            <button className="link-button" type="button" onClick={() => { setFilterItem(null); setPage(1) }}>
              Limpar item
            </button>
          ) : null}
        </FiltersBar>
        <div className="table-shell table-scroll">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Item</th>
                <th>Tipo</th>
                <th>Quantidade</th>
                <th>Motivo</th>
                <th>Autor</th>
              </tr>
            </thead>
            <tbody>
              {(movements?.items ?? []).map((movement: StockMovement) => (
                <tr key={movement.id}>
                  <td>{formatDate(movement.createdAt)}</td>
                  <td>{stockItemLabel(movement.flavorKey, movement.packSizeGrams)}</td>
                  <td>{MOVEMENT_TYPE_LABELS[movement.type] || movement.type}</td>
                  <td>{movement.quantity}</td>
                  <td>{movement.reason ? (ADJUSTMENT_REASON_LABELS[movement.reason as StockAdjustmentReason] || movement.reason) : (movement.note || '—')}</td>
                  <td>
                    {movement.subscriptionId && (movement.type === 'separation' || movement.type === 'separation_reversal') ? (
                      <Link className="table-link" to={`/billing/subscriptions/${movement.subscriptionId}`}>
                        Assinatura {movement.subscriptionId}
                      </Link>
                    ) : (movement.actorName || '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {movements && movements.totalPages > 1 ? (
          <Pager
            page={movements.page}
            totalPages={movements.totalPages}
            onPrev={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() => setPage((current) => current + 1)}
          />
        ) : null}
      </Section>

      <Dialog
        title="Lançar produção"
        open={productionOpen}
        onClose={closeDialogs}
        footer={(
          <>
            <button className="ghost-button" type="button" onClick={closeDialogs}>Cancelar</button>
            <button className="primary-button" type="submit" form="stock-production-form">Lançar</button>
          </>
        )}
      >
        <form id="stock-production-form" className="closure-form" onSubmit={submitProduction}>
          {dialogError ? <div className="alert" role="alert">{dialogError}</div> : null}
          <label className="closure-field">
            Receita
            <input required value={production.flavorKey} onChange={(event) => setProduction((current) => ({ ...current, flavorKey: event.target.value }))} />
          </label>
          <label className="closure-field">
            Tamanho (g)
            <input required type="number" min={1} value={production.packSizeGrams} onChange={(event) => setProduction((current) => ({ ...current, packSizeGrams: event.target.value }))} />
          </label>
          <label className="closure-field">
            Quantidade
            <input required type="number" min={1} max={10000} value={production.quantity} onChange={(event) => setProduction((current) => ({ ...current, quantity: event.target.value }))} />
          </label>
          <label className="closure-field">
            Nota
            <input value={production.note} onChange={(event) => setProduction((current) => ({ ...current, note: event.target.value }))} />
          </label>
        </form>
      </Dialog>

      <Dialog
        title={adjustItem ? `Ajustar ${stockItemLabel(adjustItem.flavorKey, adjustItem.packSizeGrams)}` : 'Ajustar'}
        open={Boolean(adjustItem)}
        onClose={closeDialogs}
        footer={(
          <>
            <button className="ghost-button" type="button" onClick={closeDialogs}>Cancelar</button>
            <button className="primary-button" type="submit" form="stock-adjust-form">Salvar</button>
          </>
        )}
      >
        <form id="stock-adjust-form" className="closure-form" onSubmit={submitAdjustment}>
          {dialogError ? <div className="alert" role="alert">{dialogError}</div> : null}
          <label className="closure-field">
            Quantidade
            <input required type="number" min={-10000} max={10000} value={adjustment.quantity} onChange={(event) => setAdjustment((current) => ({ ...current, quantity: event.target.value }))} />
          </label>
          <label className="closure-field">
            Motivo
            <select aria-label="Motivo" value={adjustment.reason} onChange={(event) => setAdjustment((current) => ({ ...current, reason: event.target.value as StockAdjustmentReason }))}>
              {Object.entries(ADJUSTMENT_REASON_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="closure-field">
            Nota
            <input
              required={adjustment.reason === 'other'}
              value={adjustment.note}
              onChange={(event) => setAdjustment((current) => ({ ...current, note: event.target.value }))}
            />
          </label>
        </form>
      </Dialog>

      <Dialog
        title={minimumItem ? `Mínimo de ${stockItemLabel(minimumItem.flavorKey, minimumItem.packSizeGrams)}` : 'Definir mínimo'}
        open={Boolean(minimumItem)}
        onClose={closeDialogs}
        footer={(
          <>
            <button className="ghost-button" type="button" onClick={closeDialogs}>Cancelar</button>
            <button className="primary-button" type="submit" form="stock-minimum-form">Salvar</button>
          </>
        )}
      >
        <form id="stock-minimum-form" className="closure-form" onSubmit={submitMinimum}>
          {dialogError ? <div className="alert" role="alert">{dialogError}</div> : null}
          <label className="closure-field">
            Mínimo
            <input type="number" min={0} max={10000} value={minimum.minLevel} onChange={(event) => setMinimum({ minLevel: event.target.value })} />
          </label>
        </form>
      </Dialog>
    </PageFrame>
  )
}
