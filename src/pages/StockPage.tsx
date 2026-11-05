import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Dialog } from '../components/Dialog'
import { FiltersBar } from '../components/FiltersBar'
import { MarketSelect } from '../components/MarketSelect'
import { MetricCard } from '../components/MetricCard'
import { PageFrame } from '../components/PageFrame'
import { Pager } from '../components/Pager'
import { RowMenu, type RowMenuItem } from '../components/RowMenu'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import { formatDate } from '../lib/format'
import { defaultMarket, hasBothMarkets } from '../lib/markets'
import {
  ADJUSTMENT_REASON_LABELS,
  MANUAL_ADJUSTMENT_REASONS,
  MOVEMENT_TYPE_LABELS,
  STOCK_STATUS_BADGES,
  STOCK_STATUS_LABELS,
  STOCK_WINDOWS,
  filterStockItems,
  formatSignedQuantity,
  isStockStatus,
  isStockWindow,
  sortStockItems,
  stockHref,
  stockErrorMessage,
  stockItemKey,
  stockItemLabel,
  stockPackSize,
  stockRecipeNames,
  stockRecipeOptions,
  stockStatus,
  type StockAdjustmentReason,
  type StockFilters,
  type StockItem,
  type StockMovement,
  type StockMovementType,
  type StockMovementsResponse,
  type StockOverview,
  type StockStatus,
} from '../lib/packStock'

type ProductionForm = { flavorKey: string; packSizeGrams: string; quantity: string; note: string }
type AdjustmentForm = { quantity: string; reason: StockAdjustmentReason; note: string }
type CountForm = { countedQuantity: string; note: string }
type MinimumForm = { minLevel: string }

const EMPTY_PRODUCTION: ProductionForm = { flavorKey: '', packSizeGrams: '', quantity: '', note: '' }
const EMPTY_ADJUSTMENT: AdjustmentForm = { quantity: '', reason: 'loss', note: '' }
const EMPTY_COUNT: CountForm = { countedQuantity: '', note: '' }
const PER_PAGE = 20

function highlighted(item: StockItem) {
  return stockStatus(item) !== 'ok'
}

export function StockPage() {
  const { token, user, hasPermission } = useAuth()
  const canWrite = hasPermission('production.write')
  const bothMarkets = hasBothMarkets(user)
  const lockedMarket = defaultMarket(user) ?? 'BR'

  // Window, admin market, status and search live in the URL. A value out of range or out of scope falls back.
  const [searchParams, setSearchParams] = useSearchParams()
  const urlMarket = searchParams.get('mercado')
  const market = urlMarket === 'BR' || urlMarket === 'US' ? urlMarket : lockedMarket
  const urlWindow = Number(searchParams.get('janela'))
  const windowDays = isStockWindow(urlWindow) ? urlWindow : 7
  const search = searchParams.get('busca') ?? ''
  const statusFilter: StockStatus | '' = isStockStatus(searchParams.get('situacao')) ? searchParams.get('situacao') as StockStatus : ''
  const setFilters = (next: StockFilters) => {
    const merged: StockFilters = { mercado: bothMarkets && urlMarket ? market : undefined, janela: windowDays, situacao: statusFilter, busca: search, ...next }
    setSearchParams(new URLSearchParams(stockHref(merged).split('?')[1] ?? ''), { replace: true })
  }
  const setSearch = (value: string) => setFilters({ busca: value })
  const setStatusFilter = (value: StockStatus | '') => setFilters({ situacao: value })
  const setWindowDays = (value: number) => setFilters({ janela: value })
  const setMarket = (value: 'BR' | 'US') => setFilters({ mercado: value })
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
  const [countItem, setCountItem] = useState<StockItem | null>(null)
  const [count, setCount] = useState(EMPTY_COUNT)
  const [minimumItem, setMinimumItem] = useState<StockItem | null>(null)
  const [minimum, setMinimum] = useState<MinimumForm>({ minLevel: '' })
  const [reloadKey, setReloadKey] = useState(0)
  const historyRef = useRef<HTMLDivElement>(null)

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
    setCountItem(null)
    setCount(EMPTY_COUNT)
    setMinimumItem(null)
    setMinimum({ minLevel: '' })
    setDialogError('')
  }

  const openProduction = (item?: StockItem) => {
    setDialogError('')
    setProduction(item ? {
      ...EMPTY_PRODUCTION,
      flavorKey: item.flavorKey,
      packSizeGrams: String(item.packSizeGrams),
      quantity: item.toProduce > 0 ? String(item.toProduce) : '',
    } : EMPTY_PRODUCTION)
    setProductionOpen(true)
  }

  const openHistory = (item: StockItem) => {
    setFilterItem(item)
    setPage(1)
    historyRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }

  const changeMarket = (value: string) => {
    setMarket((value || lockedMarket) as typeof lockedMarket)
    setFilterItem(null)
    setPage(1)
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
    if (Number(adjustment.quantity) === 0) {
      setDialogError('Informe uma quantidade diferente de zero.')
      return
    }
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

  const submitCount = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !countItem) return
    setDialogError('')
    try {
      await apiRequest('/admin/stock/counts', {
        token,
        method: 'POST',
        body: {
          market: scopedMarket,
          flavorKey: countItem.flavorKey,
          packSizeGrams: countItem.packSizeGrams,
          countedQuantity: Number(count.countedQuantity),
          note: count.note.trim() || undefined,
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

  const allItems = sortStockItems(overview?.items ?? [])
  const catalog = overview?.catalog ?? []
  const names = stockRecipeNames(catalog)
  const items = filterStockItems(allItems, { search, status: statusFilter, names })
  const recipeOptions = stockRecipeOptions(catalog, allItems)
  const selectedRecipe = recipeOptions.find((option) => option.flavorKey === production.flavorKey)
  const unsized = overview?.unsizedLines ?? []
  const unsizedTotal = unsized.reduce((sum, line) => sum + line.quantity, 0)
  const columnCount = 9
  const adjustmentDelta = Number(adjustment.quantity)

  const recipeName = (flavorKey: string) => names.get(flavorKey) ?? flavorKey
  const itemLabel = (item: { flavorKey: string; packSizeGrams: number }) => stockItemLabel(recipeName(item.flavorKey), item.packSizeGrams, scopedMarket)

  const emptyPacksMessage = () => {
    if (!overview) return error ? 'Estoque indisponível.' : 'Carregando estoque...'
    if (allItems.length === 0) return 'Nenhum item de estoque nem entrega nesta janela.'
    return 'Nenhum item com esses filtros.'
  }

  const rowActions = (item: StockItem): RowMenuItem[] => [
    ...(canWrite ? [
      { label: 'Lançar produção', onSelect: () => openProduction(item) },
      { label: 'Contagem', onSelect: () => { setDialogError(''); setCountItem(item); setCount(EMPTY_COUNT) } },
      { label: 'Ajustar', onSelect: () => { setDialogError(''); setAdjustItem(item); setAdjustment(EMPTY_ADJUSTMENT) } },
      { label: 'Definir mínimo', onSelect: () => { setDialogError(''); setMinimumItem(item); setMinimum({ minLevel: item.minLevel == null ? '' : String(item.minLevel) }) } },
    ] : []),
    { label: 'Ver histórico', onSelect: () => openHistory(item) },
  ]

  return (
    <PageFrame
      title="Estoque"
      description="Packs prontos contra as entregas da janela. A cozinha registra entradas, contagens e ajustes aqui."
      actions={canWrite ? (
        <button className="primary-button" type="button" onClick={() => openProduction()}>
          Lançar produção
        </button>
      ) : null}
    >
      <div className="stock-page-stack">
        <div className="stock-notice" role="note">
          <strong>Controle interno.</strong>
          {' '}
          O estoque não bloqueia vendas nem renovações e não aparece na loja: um sabor com saldo zero continua à venda.
          {' '}
          Cada pack é uma receita e um tamanho neste mercado, então variações com a mesma receita e gramas dividem o mesmo saldo.
        </div>

        {error ? <div className="alert" role="alert">{error}</div> : null}

        {canWrite && !filterItem && !filterType && movements && movements.total === 0 ? (
          // Without a first count the on-hand numbers start at zero and production alone cannot be trusted.
          <div className="warning" role="status">
            <strong>Falta a contagem inicial.</strong>
            {' '}
            Antes de lançar produção, conte os packs de cada item: no menu da linha, use Contagem com o total real.
          </div>
        ) : null}

        {unsized.length > 0 ? (
          <div className="warning stock-unsized" role="status">
            <span>{unsizedTotal} packs sem tamanho não entram no comprometido</span>
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

        <div className="grid cards-4">
          <MetricCard
            label="A produzir"
            value={overview ? allItems.reduce((sum, item) => sum + item.toProduce, 0) : '—'}
            hint={`packs em ${windowDays} dias`}
          />
          <MetricCard
            label="Em falta"
            value={overview ? allItems.filter((item) => stockStatus(item) === 'short').length : '—'}
            hint="itens sem saldo para a janela"
          />
          <MetricCard
            label="Abaixo do mínimo"
            value={overview ? allItems.filter((item) => stockStatus(item) === 'below').length : '—'}
            hint="itens para repor"
          />
          <MetricCard
            label="Em estoque"
            value={overview ? allItems.reduce((sum, item) => sum + item.onHand, 0) : '—'}
            hint={`packs em ${allItems.length} itens`}
          />
        </div>

        <Section
          title="Packs"
          description={`${items.length} de ${allItems.length} itens. Disponível = em estoque − comprometido nas entregas da janela.`}
        >
          <FiltersBar>
            <label>
              Buscar receita
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <label>
              Situação
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StockStatus | '')}>
                <option value="">Todas</option>
                {Object.entries(STOCK_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
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
            <MarketSelect user={user} value={scopedMarket} onChange={changeMarket} />
          </FiltersBar>
          <div className="table-shell table-scroll stock-table-shell">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Receita</th>
                  <th>Tamanho</th>
                  <th className="stock-number">Em estoque</th>
                  <th className="stock-number">Comprometido</th>
                  <th className="stock-number">Disponível</th>
                  <th className="stock-number">A produzir</th>
                  <th className="stock-number">Mínimo</th>
                  <th>Situação</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={columnCount}>{emptyPacksMessage()}</td>
                  </tr>
                ) : items.map((item) => {
                  const status = stockStatus(item)
                  return (
                    <tr key={stockItemKey(item)} className={highlighted(item) ? 'stock-row-warning' : undefined}>
                      <td className="stock-table-title">{recipeName(item.flavorKey)}</td>
                      <td data-label="Tamanho">{stockPackSize(item.packSizeGrams, scopedMarket)}</td>
                      <td className="stock-number" data-label="Em estoque">{item.onHand}</td>
                      <td className="stock-number" data-label="Comprometido">
                        <div className="queue-cell-stack">
                          <span>{item.committed}</span>
                          {item.committedAwaitingPayment > 0 ? (
                            <span className="muted">{item.committedAwaitingPayment} aguardando pagamento</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="stock-number stock-strong" data-label="Disponível">{item.available}</td>
                      <td className="stock-number" data-label="A produzir">{item.toProduce}</td>
                      <td className="stock-number" data-label="Mínimo">{item.minLevel ?? '—'}</td>
                      <td data-label="Situação">
                        <span className={STOCK_STATUS_BADGES[status]}>{STOCK_STATUS_LABELS[status]}</span>
                      </td>
                      <td className="stock-table-actions">
                        <RowMenu label={`Ações de ${itemLabel(item)}`} items={rowActions(item)} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Section>

        <div ref={historyRef} className="stock-history-anchor">
          <Section title="Histórico" description={filterItem ? itemLabel(filterItem) : 'Todos os itens'}>
            <FiltersBar>
              <label>
                Item
                <select
                  aria-label="Item do histórico"
                  value={filterItem ? stockItemKey(filterItem) : ''}
                  onChange={(event) => {
                    setFilterItem(allItems.find((item) => stockItemKey(item) === event.target.value) ?? null)
                    setPage(1)
                  }}
                >
                  <option value="">Todos</option>
                  {allItems.map((item) => (
                    <option key={stockItemKey(item)} value={stockItemKey(item)}>{itemLabel(item)}</option>
                  ))}
                </select>
              </label>
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
            </FiltersBar>
            <div className="table-shell table-scroll stock-table-shell">
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Item</th>
                    <th>Tipo</th>
                    <th className="stock-number">Quantidade</th>
                    <th>Motivo</th>
                    <th>Autor</th>
                  </tr>
                </thead>
                <tbody>
                  {movements && movements.items.length === 0 ? (
                    <tr>
                      <td colSpan={6}>Nenhum movimento encontrado.</td>
                    </tr>
                  ) : (movements?.items ?? []).map((movement: StockMovement) => {
                    const reason = movement.reason
                      ? (ADJUSTMENT_REASON_LABELS[movement.reason as StockAdjustmentReason] || movement.reason)
                      : null
                    return (
                      <tr key={movement.id}>
                        <td data-label="Data">{formatDate(movement.createdAt)}</td>
                        <td className="stock-table-title">{itemLabel(movement)}</td>
                        <td data-label="Tipo">{MOVEMENT_TYPE_LABELS[movement.type] || movement.type}</td>
                        <td className="stock-number stock-strong" data-label="Quantidade">{formatSignedQuantity(movement.quantity)}</td>
                        <td data-label="Motivo">
                          <div className="queue-cell-stack">
                            <span>{reason ?? (movement.note ? movement.note : '—')}</span>
                            {reason && movement.note ? <span className="muted">{movement.note}</span> : null}
                          </div>
                        </td>
                        <td data-label="Autor">
                          {movement.subscriptionId && (movement.type === 'separation' || movement.type === 'separation_reversal') ? (
                            <Link className="table-link" to={`/billing/subscriptions/${movement.subscriptionId}`}>
                              Assinatura {movement.subscriptionId}
                            </Link>
                          ) : (movement.actorName || '—')}
                        </td>
                      </tr>
                    )
                  })}
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
        </div>
      </div>

      <Dialog
        title="Lançar produção"
        description="Soma os packs que entraram ao saldo atual."
        open={productionOpen}
        onClose={closeDialogs}
        footer={(
          <>
            <button className="ghost-button" type="button" onClick={closeDialogs}>Cancelar</button>
            <button className="primary-button" type="submit" form="stock-production-form">Adicionar</button>
          </>
        )}
      >
        <form id="stock-production-form" className="closure-form" onSubmit={submitProduction}>
          {dialogError ? <div className="alert" role="alert">{dialogError}</div> : null}
          {recipeOptions.length > 0 && catalog.length > 0 ? (
            <>
              <label className="closure-field">
                Receita
                <select
                  required
                  value={production.flavorKey}
                  onChange={(event) => {
                    const sizes = recipeOptions.find((option) => option.flavorKey === event.target.value)?.sizes ?? []
                    setProduction((current) => ({
                      ...current,
                      flavorKey: event.target.value,
                      packSizeGrams: sizes.length === 1 ? String(sizes[0]) : '',
                    }))
                  }}
                >
                  <option value="">Selecione</option>
                  {recipeOptions.map((option) => (
                    <option key={option.flavorKey} value={option.flavorKey}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="closure-field">
                Tamanho
                <select
                  required
                  disabled={!selectedRecipe}
                  value={production.packSizeGrams}
                  onChange={(event) => setProduction((current) => ({ ...current, packSizeGrams: event.target.value }))}
                >
                  <option value="">Selecione</option>
                  {(selectedRecipe?.sizes ?? []).map((grams) => (
                    <option key={grams} value={grams}>{stockPackSize(grams, scopedMarket)}</option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <label className="closure-field">
                Receita
                <input required value={production.flavorKey} onChange={(event) => setProduction((current) => ({ ...current, flavorKey: event.target.value }))} />
              </label>
              <label className="closure-field">
                Tamanho (g)
                <input required type="number" min={1} value={production.packSizeGrams} onChange={(event) => setProduction((current) => ({ ...current, packSizeGrams: event.target.value }))} />
              </label>
            </>
          )}
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
        title={adjustItem ? `Ajustar ${itemLabel(adjustItem)}` : 'Ajustar'}
        description="Use número negativo para baixar e positivo para somar ao saldo."
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
          {adjustItem ? (
            <p className="muted">
              Em estoque: {adjustItem.onHand}
              {Number.isFinite(adjustmentDelta) && adjustmentDelta !== 0 ? ` → novo saldo: ${adjustItem.onHand + adjustmentDelta}` : ''}
            </p>
          ) : null}
          <label className="closure-field">
            Motivo
            <select aria-label="Motivo" value={adjustment.reason} onChange={(event) => setAdjustment((current) => ({ ...current, reason: event.target.value as StockAdjustmentReason }))}>
              {MANUAL_ADJUSTMENT_REASONS.map((value) => (
                <option key={value} value={value}>{ADJUSTMENT_REASON_LABELS[value]}</option>
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
        title={countItem ? `Contagem de ${itemLabel(countItem)}` : 'Contagem'}
        description="Informe o total real de packs. O sistema lança só a diferença em relação ao saldo atual e a registra no histórico."
        open={Boolean(countItem)}
        onClose={closeDialogs}
        footer={(
          <>
            <button className="ghost-button" type="button" onClick={closeDialogs}>Cancelar</button>
            <button className="primary-button" type="submit" form="stock-count-form">Salvar</button>
          </>
        )}
      >
        <form id="stock-count-form" className="closure-form" onSubmit={submitCount}>
          {dialogError ? <div className="alert" role="alert">{dialogError}</div> : null}
          <label className="closure-field">
            Quantidade contada
            <input required type="number" min={0} max={10000} value={count.countedQuantity} onChange={(event) => setCount((current) => ({ ...current, countedQuantity: event.target.value }))} />
          </label>
          {countItem ? (
            <p className="muted">
              Em estoque: {countItem.onHand}
              {count.countedQuantity.trim() !== '' ? ` → novo saldo: ${Number(count.countedQuantity)}` : ''}
            </p>
          ) : null}
          <label className="closure-field">
            Nota
            <input value={count.note} onChange={(event) => setCount((current) => ({ ...current, note: event.target.value }))} />
          </label>
        </form>
      </Dialog>

      <Dialog
        title={minimumItem ? `Mínimo de ${itemLabel(minimumItem)}` : 'Definir mínimo'}
        description="A situação fica abaixo do mínimo quando o disponível é menor que este valor. Deixe vazio para remover."
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
