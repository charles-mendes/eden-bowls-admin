import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Dialog } from '../components/Dialog'
import { FiltersBar } from '../components/FiltersBar'
import { InfoHint } from '../components/InfoHint'
import { MarketSelect } from '../components/MarketSelect'
import { MetricCard } from '../components/MetricCard'
import { PageFrame } from '../components/PageFrame'
import { Pager } from '../components/Pager'
import { RowMenu, type RowMenuItem } from '../components/RowMenu'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import { formatDate } from '../lib/format'
import { LIFE_STAGE_LABELS } from '../lib/recipeContent'
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
  stockProductOptions,
  stockProducts,
  sortVariationsWithoutWeight,
  stockVariationSkus,
  variationWeightHref,
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
// The operator types how many packs; the sign comes from the reason (and from Baixar/Somar when the reason is Outro).
type AdjustmentForm = { quantity: string; reason: StockAdjustmentReason; direction: 'out' | 'in'; note: string }
type CountForm = { countedQuantity: string; note: string }
type MinimumForm = { minLevel: string }

const EMPTY_PRODUCTION: ProductionForm = { flavorKey: '', packSizeGrams: '', quantity: '', note: '' }
const EMPTY_ADJUSTMENT: AdjustmentForm = { quantity: '', reason: 'loss', direction: 'out', note: '' }
const EMPTY_COUNT: CountForm = { countedQuantity: '', note: '' }
const PER_PAGE = 20

// Free text kept with the movement and shown in Histórico. Not an invoice: "Nota" read as nota fiscal, so it is
// named Observação, with its meaning behind the "i".
function ObservationField({ id, value, onChange, required = false, hint }: {
  id: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  hint: string
}) {
  return (
    <div className="closure-field field-with-hint stock-observation-field">
      <div className="field-label-row">
        <label htmlFor={id}>{required ? 'Observação (obrigatória)' : 'Observação (opcional)'}</label>
        <InfoHint id={`${id}-hint`} topic="a observação" text={hint} />
      </div>
      <input id={id} value={value} maxLength={255} required={required} aria-describedby={`${id}-hint`} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

const OBSERVATION_HINT = 'Texto livre que fica no Histórico do Estoque junto com este movimento. Não é nota fiscal.'

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
    if (!(adjustmentPacks > 0)) {
      setDialogError('Informe uma quantidade maior que zero.')
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
          quantity: adjustmentDelta,
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
  const products = stockProducts(catalog)
  const skus = stockVariationSkus(catalog)
  const items = filterStockItems(allItems, { search, status: statusFilter, products, skus })
  const productOptions = stockProductOptions(catalog, allItems)
  const selectedProduct = productOptions.find((option) => option.flavorKey === production.flavorKey)
  const unsized = overview?.unsizedLines ?? []
  const withoutWeight = sortVariationsWithoutWeight(overview?.variationsWithoutWeight ?? [])
  // Products on sale with no variation weighed yet: listed disabled, so whoever registers them sees what is missing.
  const sellableProductIds = new Set(
    productOptions.map((option) => products.get(option.flavorKey)?.productId).filter((id): id is string => Boolean(id)),
  )
  const productsWithoutWeight = withoutWeight
    .filter((item, index) => !sellableProductIds.has(item.productId)
      && withoutWeight.findIndex((other) => other.productId === item.productId) === index)
  const unsizedTotal = unsized.reduce((sum, line) => sum + line.quantity, 0)
  const columnCount = 9
  const adjustmentPacks = Math.abs(Number(adjustment.quantity))
  const adjustmentAdds = adjustment.reason === 'other' && adjustment.direction === 'in'
  const adjustmentDelta = adjustmentAdds ? adjustmentPacks : -adjustmentPacks
  const countedTotal = count.countedQuantity.trim() === '' ? null : Number(count.countedQuantity)
  const countDifference = countItem && countedTotal != null && Number.isFinite(countedTotal) ? countedTotal - countItem.onHand : null

  const productName = (flavorKey: string) => products.get(flavorKey)?.name ?? flavorKey
  // Product code and variation SKU under the name; the code is left out when it already is the name.
  const productMeta = (item: StockItem) => {
    const sku = skus.get(stockItemKey(item))
    return [productName(item.flavorKey) === item.flavorKey ? '' : item.flavorKey, sku ? `SKU ${sku}` : '']
      .filter(Boolean)
      .join(' · ')
  }
  const itemLabel = (item: { flavorKey: string; packSizeGrams: number }) => stockItemLabel(productName(item.flavorKey), item.packSizeGrams, scopedMarket)

  const emptyPacksMessage = () => {
    if (!overview) return error ? 'Estoque indisponível.' : 'Carregando estoque...'
    if (allItems.length === 0) return 'Nenhum item de estoque nem entrega nesta janela.'
    return 'Nenhum item com esses filtros.'
  }

  const rowActions = (item: StockItem): RowMenuItem[] => [
    ...(canWrite ? [
      { label: 'Lançar produção', hint: 'Soma os packs que a cozinha produziu', onSelect: () => openProduction(item) },
      { label: 'Contar estoque', hint: 'Informe o total contado; o sistema acerta a diferença', onSelect: () => { setDialogError(''); setCountItem(item); setCount(EMPTY_COUNT) } },
      { label: 'Registrar perda ou ajuste', hint: 'Perda, vencimento, amostra ou outro motivo', onSelect: () => { setDialogError(''); setAdjustItem(item); setAdjustment(EMPTY_ADJUSTMENT) } },
      { label: 'Definir mínimo', hint: 'Alerta de reposição; não mexe no saldo', separated: true, onSelect: () => { setDialogError(''); setMinimumItem(item); setMinimum({ minLevel: item.minLevel == null ? '' : String(item.minLevel) }) } },
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
          Cada linha é uma variação de produto deste mercado: o produto (a receita) e o tamanho do pack.
        </div>

        {error ? <div className="alert" role="alert">{error}</div> : null}

        {canWrite && !filterItem && !filterType && movements && movements.total === 0 ? (
          // Without a first count the on-hand numbers start at zero and production alone cannot be trusted.
          <div className="warning" role="status">
            <strong>Falta a contagem inicial.</strong>
            {' '}
            Antes de lançar produção, conte os packs de cada item: no menu da linha, use Contar estoque com o total real.
          </div>
        ) : null}

        {withoutWeight.length > 0 ? (
          <div className="warning stock-weight-missing" role="status">
            <p>
              <strong>
                {withoutWeight.length === 1 ? '1 variação à venda está sem peso' : `${withoutWeight.length} variações à venda estão sem peso`}
              </strong>
              {' '}e fica{withoutWeight.length === 1 ? '' : 'm'} fora do estoque. Informe o peso de cada uma:
            </p>
            <ul aria-label="Variações sem peso">
              {withoutWeight.map((item) => {
                const stage = item.lifeStage ? LIFE_STAGE_LABELS[item.lifeStage] : ''
                return (
                  <li key={item.variationId}>
                    <Link
                      to={variationWeightHref(item)}
                      aria-label={`Informar peso de ${[item.productName, stage, item.sku ? `SKU ${item.sku}` : ''].filter(Boolean).join(', ')}`}
                    >
                      <span className="weight-missing-name" title={item.productName}>{item.productName}</span>
                      <span className="weight-missing-stage">{stage || '—'}</span>
                      <span className="weight-missing-sku mono">{item.sku ? `SKU ${item.sku}` : 'Sem SKU'}</span>
                      <span className="weight-missing-action">Informar peso<span aria-hidden="true"> →</span></span>
                    </Link>
                  </li>
                )
              })}
            </ul>
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
                {(line.flavorKey && products.get(line.flavorKey)?.name) || line.label || line.flavorKey || 'pack'} × {line.quantity}
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
              Buscar produto
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
                  <th>Produto</th>
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
                      <td className="stock-table-title">
                        <div className="queue-cell-stack">
                          {products.get(item.flavorKey)?.productId ? (
                            <Link className="table-link" to={`/catalog/products/${products.get(item.flavorKey)?.productId}`}>
                              {productName(item.flavorKey)}
                            </Link>
                          ) : (
                            <span>{productName(item.flavorKey)}</span>
                          )}
                          {productMeta(item) ? <span className="cell-meta mono">{productMeta(item)}</span> : null}
                        </div>
                      </td>
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
          {productOptions.length > 0 && catalog.length > 0 ? (
            <>
              <label className="closure-field">
                Produto
                <select
                  required
                  aria-describedby={productsWithoutWeight.length && !production.flavorKey ? 'stock-production-without-weight' : undefined}
                  value={production.flavorKey}
                  onChange={(event) => {
                    const sizes = productOptions.find((option) => option.flavorKey === event.target.value)?.sizes ?? []
                    setProduction((current) => ({
                      ...current,
                      flavorKey: event.target.value,
                      packSizeGrams: sizes.length === 1 ? String(sizes[0]) : '',
                    }))
                  }}
                >
                  <option value="">Selecione</option>
                  {productOptions.map((option) => (
                    <option key={option.flavorKey} value={option.flavorKey}>{option.label}</option>
                  ))}
                  {productsWithoutWeight.length ? (
                    <optgroup label="Sem peso cadastrado">
                      {productsWithoutWeight.map((item) => (
                        <option key={item.productId} value={`sem-peso-${item.productId}`} disabled>
                          {[item.productName, item.lifeStage ? LIFE_STAGE_LABELS[item.lifeStage] : ''].filter(Boolean).join(' · ')} (sem peso)
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
              </label>
              {productsWithoutWeight.length && !production.flavorKey ? (
                <p id="stock-production-without-weight" className="field-hint warning-text">
                  {productsWithoutWeight.length === 1
                    ? '1 produto está desabilitado porque não tem peso na variação.'
                    : `${productsWithoutWeight.length} produtos estão desabilitados porque não têm peso na variação.`}
                  {' '}Informe o peso pelo aviso no topo do Estoque para lançar.
                </p>
              ) : null}
              <label className="closure-field">
                Tamanho
                <select
                  required
                  disabled={!selectedProduct}
                  value={production.packSizeGrams}
                  onChange={(event) => setProduction((current) => ({ ...current, packSizeGrams: event.target.value }))}
                >
                  <option value="">Selecione</option>
                  {(selectedProduct?.sizes ?? []).map((grams) => (
                    <option key={grams} value={grams}>{stockPackSize(grams, scopedMarket)}</option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <label className="closure-field">
                Código do produto
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
          <ObservationField
            id="stock-production-note"
            value={production.note}
            onChange={(note) => setProduction((current) => ({ ...current, note }))}
            hint={`${OBSERVATION_HINT} Use para o lote, a data de fabricação ou quem produziu.`}
          />
        </form>
      </Dialog>

      <Dialog
        title={adjustItem ? `Perda ou ajuste de ${itemLabel(adjustItem)}` : 'Perda ou ajuste'}
        description="Perda, vencimento e amostra sempre baixam o saldo. Para corrigir o total depois de contar, use Contar estoque."
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
            Motivo
            <select aria-label="Motivo" value={adjustment.reason} onChange={(event) => setAdjustment((current) => ({ ...current, reason: event.target.value as StockAdjustmentReason, direction: 'out' }))}>
              {MANUAL_ADJUSTMENT_REASONS.map((value) => (
                <option key={value} value={value}>{ADJUSTMENT_REASON_LABELS[value]}</option>
              ))}
            </select>
          </label>
          {adjustment.reason === 'other' ? (
            <fieldset className="closure-field stock-direction">
              <legend>Movimento</legend>
              <label>
                <input type="radio" name="stock-adjust-direction" value="out" checked={adjustment.direction === 'out'} onChange={() => setAdjustment((current) => ({ ...current, direction: 'out' }))} />
                Baixar do saldo
              </label>
              <label>
                <input type="radio" name="stock-adjust-direction" value="in" checked={adjustment.direction === 'in'} onChange={() => setAdjustment((current) => ({ ...current, direction: 'in' }))} />
                Somar ao saldo
              </label>
            </fieldset>
          ) : null}
          <label className="closure-field">
            {adjustmentAdds ? 'Packs a somar' : 'Packs a baixar'}
            <input required type="number" min={1} max={10000} value={adjustment.quantity} onChange={(event) => setAdjustment((current) => ({ ...current, quantity: event.target.value }))} />
          </label>
          {adjustItem ? (
            <p className="muted stock-balance-preview">
              Em estoque: {adjustItem.onHand}
              {adjustmentPacks > 0 ? ` → novo saldo: ${adjustItem.onHand + adjustmentDelta}` : ''}
            </p>
          ) : null}
          <ObservationField
            id="stock-adjustment-note"
            value={adjustment.note}
            required={adjustment.reason === 'other'}
            onChange={(note) => setAdjustment((current) => ({ ...current, note }))}
            hint={`${OBSERVATION_HINT} Explique o que aconteceu; é obrigatória quando o motivo é Outro.`}
          />
        </form>
      </Dialog>

      <Dialog
        title={countItem ? `Contar estoque de ${itemLabel(countItem)}` : 'Contar estoque'}
        description="Informe o total de packs que você contou. O sistema lança só a diferença em relação ao saldo atual."
        open={Boolean(countItem)}
        onClose={closeDialogs}
        footer={(
          <>
            <button className="ghost-button" type="button" onClick={closeDialogs}>Cancelar</button>
            <button className="primary-button" type="submit" form="stock-count-form">Salvar contagem</button>
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
            <div className="stock-count-preview" role="status">
              <p className="muted">
                Saldo no sistema: {countItem.onHand}
                {countedTotal != null ? ` → novo saldo: ${countedTotal}` : ''}
              </p>
              {countDifference === 0 ? (
                <p>Confere com o saldo. Nada será registrado no histórico.</p>
              ) : countDifference != null ? (
                <p>
                  <strong>{formatSignedQuantity(countDifference)} {Math.abs(countDifference) === 1 ? 'pack' : 'packs'}</strong>
                  {' '}{countDifference > 0 ? 'a mais' : 'a menos'} que o sistema. Fica no histórico como Ajuste · Contagem.
                </p>
              ) : null}
            </div>
          ) : null}
          <ObservationField
            id="stock-count-note"
            value={count.note}
            onChange={(note) => setCount((current) => ({ ...current, note }))}
            hint={`${OBSERVATION_HINT} Use para registrar onde ou por quem a contagem foi feita.`}
          />
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
