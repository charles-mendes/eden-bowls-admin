import { useEffect, useState, type FormEvent } from 'react'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { FiltersBar } from '../components/FiltersBar'
import { Dialog } from '../components/Dialog'
import { AccountSelect } from '../components/MarketSelect'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import { formatTermMonths } from '../lib/format'
import { defaultStripeAccount, hasBothMarkets, type StripeAccount } from '../lib/markets'

type PromoSlot = {
  promotion_code_id?: string | null
  coupon_id?: string | null
  active?: boolean
  source?: 'stored' | 'stripe'
}

type PromoHealth = {
  complete: boolean
  missing_terms: number[]
  mapping: Record<string, string | null>
  misconfig_count: number
  slots?: Record<string, PromoSlot>
  missing_in_stripe?: number[]
  inactive?: number[]
}

type PromoCode = {
  id: string
  code: string
  coupon_id?: string
  percent_off?: number | null
  duration?: string | null
  active: boolean
  slot: number | null
  dashboard_url: string
}

type Term = 1 | 3 | 6

type SlotStatus = 'empty' | 'missing' | 'inactive' | 'active' | 'linked'

const TERMS: Term[] = [1, 3, 6]
const TERM_PERCENT: Record<Term, number> = { 1: 10, 3: 25, 6: 40 }

const emptyMapping = { 1: '', 3: '', 6: '' }

const noticeCopy: Record<string, string> = {
  mapped: 'Mapa salvo no banco.',
  created: 'Cupom criado na Stripe e gravado no banco.',
  synced: 'Mapa sincronizado com a Stripe.',
}

const statusBadge: Record<SlotStatus, { label: string; className: string }> = {
  empty: { label: 'Sem cupom', className: 'badge-error' },
  missing: { label: 'Não encontrado na Stripe', className: 'badge-error' },
  inactive: { label: 'Inativo na Stripe', className: 'badge-warning' },
  active: { label: 'Ativo', className: 'badge-success' },
  linked: { label: 'Vinculado', className: 'badge-info' },
}

function mappingFromHealth(health: PromoHealth) {
  return {
    1: health.mapping?.[1] || health.mapping?.['1'] || '',
    3: health.mapping?.[3] || health.mapping?.['3'] || '',
    6: health.mapping?.[6] || health.mapping?.['6'] || '',
  }
}

const durationCopy: Record<string, string> = {
  once: 'Só a 1ª fatura',
  repeating: 'Alguns meses',
  forever: 'Todas as faturas',
}

function formatPromoDuration(duration: string | null | undefined) {
  const raw = String(duration || '').trim()
  if (!raw) return 'Não expira'
  return durationCopy[raw] || raw
}

function slotStatus(term: Term, promoId: string, health: PromoHealth | null, listed: PromoCode | undefined): SlotStatus {
  if (!promoId) return 'empty'
  if (health?.missing_in_stripe?.includes(term)) return 'missing'
  if (health?.inactive?.includes(term)) return 'inactive'
  if (listed) return listed.active ? 'active' : 'inactive'
  const synced = health?.slots?.[term]
  if (synced) return synced.active ? 'active' : 'inactive'
  return 'linked'
}

export function CouponsPage() {
  const { token, user, hasPermission } = useAuth()
  const canWrite = hasPermission('billing.coupons.write')
  const bothMarkets = hasBothMarkets(user)
  const [pickedAccount, setPickedAccount] = useState<StripeAccount | ''>('')
  const [health, setHealth] = useState<PromoHealth | null>(null)
  const [mapping, setMapping] = useState(emptyMapping)
  const [codes, setCodes] = useState<PromoCode[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [term, setTerm] = useState<Term>(1)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [maxRedemptions, setMaxRedemptions] = useState(0)
  const [assignSlot, setAssignSlot] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [creating, setCreating] = useState(false)
  const account = (bothMarkets ? pickedAccount : null) || defaultStripeAccount(user)

  const applyHealth = (nextHealth: PromoHealth) => {
    setHealth(nextHealth)
    setMapping(mappingFromHealth(nextHealth))
  }

  const accountQuery = buildQueryString({ account })

  const loadCodes = async () => {
    const codesResponse = await apiRequest<{ success?: boolean; data?: { items: PromoCode[] }; message?: string }>(`/admin/stripe/promotion-codes${accountQuery}`, { token })
    setCodes(codesResponse.data?.items || [])
    if (codesResponse.success === false && codesResponse.message) {
      setError(codesResponse.message)
    }
  }

  const load = async () => {
    if (!token || !user || !account) return
    try {
      setError('')
      const [healthResponse] = await Promise.all([
        apiRequest<PromoHealth>(`/admin/stripe/first-purchase-promos${accountQuery}`, { token }),
        loadCodes(),
      ])
      applyHealth(healthResponse)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar cupons')
    }
  }

  useEffect(() => {
    void load()
  }, [token, user, account])

  const saveMap = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !account) return
    try {
      setError('')
      const response = await apiRequest<PromoHealth>(`/admin/stripe/first-purchase-promos${accountQuery}`, {
        token,
        method: 'PUT',
        body: { ...mapping, account },
      })
      applyHealth(response)
      setMessage('mapped')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao mapear')
    }
  }

  const syncStripe = async () => {
    if (!token || !account) return
    try {
      setError('')
      setSyncing(true)
      const response = await apiRequest<PromoHealth>(`/admin/stripe/first-purchase-promos/sync${accountQuery}`, {
        token,
        method: 'POST',
        body: { account },
      })
      applyHealth(response)
      setMessage('synced')
      await loadCodes()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao sincronizar com a Stripe')
    } finally {
      setSyncing(false)
    }
  }

  const openCreate = (nextTerm: Term) => {
    setTerm(nextTerm)
    setCode('')
    setName('')
    setMaxRedemptions(0)
    setAssignSlot(true)
    setCreateOpen(true)
  }

  const createCoupon = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !account) return
    try {
      setError('')
      setCreating(true)
      await apiRequest('/admin/stripe/first-purchase-coupons', {
        token,
        method: 'POST',
        body: {
          term_months: term,
          code,
          name,
          max_redemptions: maxRedemptions,
          assign_first_purchase_slot: assignSlot,
          account,
        },
      })
      setMessage('created')
      setCreateOpen(false)
      await load()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao criar cupom')
    } finally {
      setCreating(false)
    }
  }

  const percent = TERM_PERCENT[term]
  const currentForTerm = mapping[term]
  const currentCode = codes.find((item) => item.id === currentForTerm)?.code

  return (
    <PageFrame title="Cupons de 1ª compra" description="Desconto automático da primeira compra, por prazo do plano. Brasil e EUA têm cupons separados na Stripe.">
      <FiltersBar>
        <AccountSelect
          user={user}
          value={account ?? ''}
          onChange={(value) => {
            setPickedAccount(value === 'us' ? 'us' : 'br')
            setMessage('')
            setHealth(null)
            setCodes([])
            setMapping(emptyMapping)
          }}
        />
      </FiltersBar>

      {health && !health.complete ? (
        <div className="alert">Faltam cupons para {health.missing_terms.map((item) => formatTermMonths(item)).join(', ')}. O checkout de cliente elegível fica bloqueado até cada prazo ter um cupom.</div>
      ) : null}
      {health && health.misconfig_count > 0 ? (
        <div className="warning">Configurações inconsistentes: {health.misconfig_count}</div>
      ) : null}
      {error ? <div className="alert">{error}</div> : null}
      {message ? <div className="success">{noticeCopy[message] || message}</div> : null}

      <Section
        title="Cupom por prazo"
        description="Cada prazo do plano usa um código de promoção. Crie aqui para gerar o cupom na Stripe e vincular na hora, ou use Sincronizar para trazer os que já existem na conta."
        actions={canWrite ? (
          <button className="ghost-button" type="button" onClick={() => void syncStripe()} disabled={syncing}>
            {syncing ? 'Sincronizando…' : 'Sincronizar com Stripe'}
          </button>
        ) : undefined}
      >
        <div className="coupon-slots">
          {TERMS.map((slotTerm) => {
            const promoId = mapping[slotTerm]
            const listed = codes.find((item) => item.id === promoId)
            const status = slotStatus(slotTerm, promoId, health, listed)
            const badge = statusBadge[status]
            const couponId = listed?.coupon_id || health?.slots?.[slotTerm]?.coupon_id || ''
            const needsCoupon = status === 'empty' || status === 'missing' || status === 'inactive'
            return (
              <article key={slotTerm} className="coupon-slot" aria-label={`Prazo ${formatTermMonths(slotTerm)}`}>
                <header className="coupon-slot-head">
                  <div>
                    <h4>{formatTermMonths(slotTerm)}</h4>
                    <p className="muted">{TERM_PERCENT[slotTerm]}% na 1ª fatura</p>
                  </div>
                  <span className={badge.className}>{badge.label}</span>
                </header>
                {promoId ? (
                  <dl className="coupon-slot-meta">
                    <div><dt>Código</dt><dd>{listed?.code || '-'}</dd></div>
                    <div><dt>Promo</dt><dd className="coupon-id">{promoId}</dd></div>
                    <div><dt>Cupom</dt><dd className="coupon-id">{couponId || '-'}</dd></div>
                  </dl>
                ) : (
                  <p className="muted coupon-slot-empty">Nenhum cupom vinculado a este prazo.</p>
                )}
                <div className="coupon-slot-actions">
                  {canWrite ? (
                    <button
                      className={needsCoupon ? 'primary-button' : 'ghost-button'}
                      type="button"
                      onClick={() => openCreate(slotTerm)}
                      aria-label={`${needsCoupon ? 'Criar cupom' : 'Substituir cupom'} de ${formatTermMonths(slotTerm)}`}
                    >
                      {needsCoupon ? 'Criar cupom' : 'Substituir'}
                    </button>
                  ) : null}
                  {listed ? (
                    <a className="table-link" href={listed.dashboard_url} target="_blank" rel="noreferrer">Abrir na Stripe</a>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>

        <div className="muted-panel coupon-note">
          O desconto vale só na primeira fatura mensal. Nos planos de 3 e 6 meses, os meses seguintes cobram o preço cheio. O percentual maior (25%/40%) é benefício de compromisso, não desconto sobre o total do contrato.
        </div>

        {canWrite ? (
          <details className="maintenance-panel">
            <summary>Vincular ID manualmente</summary>
            <p className="muted">Só para um código criado direto no painel da Stripe que a sincronização não reconheceu. O ID começa com promo_.</p>
            <form className="form-toolbar" onSubmit={saveMap}>
              <div className="form-grid">
                {TERMS.map((slotTerm) => (
                  <label key={slotTerm}>
                    {`${formatTermMonths(slotTerm)} — ${TERM_PERCENT[slotTerm]}%`}
                    <input
                      value={mapping[slotTerm]}
                      onChange={(event) => setMapping((current) => ({ ...current, [slotTerm]: event.target.value }))}
                      placeholder="promo_..."
                    />
                  </label>
                ))}
              </div>
              <div className="inline-actions">
                <button className="ghost-button" type="submit">Salvar mapa</button>
              </div>
            </form>
          </details>
        ) : null}
      </Section>

      <Section title="Códigos na Stripe" description="Os 25 códigos de promoção mais recentes desta conta.">
        <div className="table-shell table-scroll">
          <table className="stack-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Desconto</th>
                <th>Duração</th>
                <th>Status</th>
                <th>Prazo</th>
                <th><span className="sr-only">Stripe</span></th>
              </tr>
            </thead>
            <tbody>
              {codes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">Nenhum código de promoção nesta conta.</td>
                </tr>
              ) : codes.map((item) => (
                <tr key={item.id}>
                  <td className="stack-table-title">
                    <strong>{item.code}</strong>
                    <div className="coupon-id muted">{item.id}{item.coupon_id ? ` · ${item.coupon_id}` : ''}</div>
                  </td>
                  <td data-label="Desconto">{item.percent_off == null ? '-' : `${item.percent_off}%`}</td>
                  <td data-label="Duração">{formatPromoDuration(item.duration)}</td>
                  <td data-label="Status"><span className={item.active ? 'badge-success' : 'badge-warning'}>{item.active ? 'Ativo' : 'Inativo'}</span></td>
                  <td data-label="Prazo">{formatTermMonths(item.slot)}</td>
                  <td data-label="Stripe"><a className="table-link" href={item.dashboard_url} target="_blank" rel="noreferrer">Abrir</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Criar cupom na Stripe"
        description={`Cria o cupom e o código na conta ${String(account || '').toUpperCase()}, válidos só na primeira compra. O percentual é fixo por prazo.`}
      >
        <form className="form-toolbar" onSubmit={createCoupon}>
          <div className="form-grid">
            <label>
              Prazo
              <select value={term} onChange={(event) => setTerm(Number(event.target.value) as Term)}>
                {TERMS.map((slotTerm) => (
                  <option key={slotTerm} value={slotTerm}>{`${formatTermMonths(slotTerm)} — ${TERM_PERCENT[slotTerm]}%`}</option>
                ))}
              </select>
            </label>
            <label>
              Código
              <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder={`BEMVINDO${percent}`} required />
            </label>
            <label>
              Nome
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder={`First purchase ${term}m (${percent}%)`} />
            </label>
            <label>
              Máximo de usos
              <input type="number" min={0} value={maxRedemptions} onChange={(event) => setMaxRedemptions(Number(event.target.value))} />
              <span className="muted">0 = sem limite</span>
            </label>
            <label className="checkbox-field">
              <input type="checkbox" checked={assignSlot} onChange={(event) => setAssignSlot(event.target.checked)} />
              Usar no checkout de {formatTermMonths(term)}
            </label>
          </div>
          {assignSlot && currentForTerm ? (
            <div className="warning">Substitui o código atual de {formatTermMonths(term)} ({currentCode || currentForTerm}). O antigo continua na Stripe.</div>
          ) : null}
          <div className="inline-actions">
            <button className="ghost-button" type="button" onClick={() => setCreateOpen(false)}>Cancelar</button>
            <button className="primary-button" type="submit" disabled={creating}>{creating ? 'Criando…' : 'Criar na Stripe'}</button>
          </div>
        </form>
      </Dialog>
    </PageFrame>
  )
}
