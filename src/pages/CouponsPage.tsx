import { useEffect, useState, type FormEvent } from 'react'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'

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

const emptyMapping = { 1: '', 3: '', 6: '' }

const noticeCopy: Record<string, string> = {
  mapped: 'Mapa salvo no banco.',
  created: 'Cupom criado na Stripe e gravado no banco.',
  synced: 'Slots sincronizados com a Stripe.',
}

function mappingFromHealth(health: PromoHealth) {
  return {
    1: health.mapping?.[1] || health.mapping?.['1'] || '',
    3: health.mapping?.[3] || health.mapping?.['3'] || '',
    6: health.mapping?.[6] || health.mapping?.['6'] || '',
  }
}

function formatPromoDuration(duration: string | null | undefined) {
  const raw = String(duration || '').trim()
  return raw || 'Não expira'
}

export function CouponsPage() {
  const { token } = useAuth()
  const [health, setHealth] = useState<PromoHealth | null>(null)
  const [mapping, setMapping] = useState(emptyMapping)
  const [codes, setCodes] = useState<PromoCode[]>([])
  const [term, setTerm] = useState(1)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [maxRedemptions, setMaxRedemptions] = useState(0)
  const [assignSlot, setAssignSlot] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [syncing, setSyncing] = useState(false)

  const applyHealth = (nextHealth: PromoHealth) => {
    setHealth(nextHealth)
    setMapping(mappingFromHealth(nextHealth))
  }

  const load = async () => {
    if (!token) return
    try {
      setError('')
      const [healthResponse, codesResponse] = await Promise.all([
        apiRequest<PromoHealth>('/admin/stripe/first-purchase-promos', { token }),
        apiRequest<{ success?: boolean; data?: { items: PromoCode[] }; message?: string }>('/admin/stripe/promotion-codes', { token }),
      ])
      applyHealth(healthResponse)
      setCodes(codesResponse.data?.items || [])
      if (codesResponse.success === false && codesResponse.message) {
        setError(codesResponse.message)
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar cupons')
    }
  }

  useEffect(() => {
    void load()
  }, [token])

  const saveMap = async (event: FormEvent) => {
    event.preventDefault()
    if (!token) return
    try {
      setError('')
      const response = await apiRequest<PromoHealth>('/admin/stripe/first-purchase-promos', {
        token,
        method: 'PUT',
        body: mapping,
      })
      applyHealth(response)
      setMessage('mapped')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao mapear')
    }
  }

  const syncStripe = async () => {
    if (!token) return
    try {
      setError('')
      setSyncing(true)
      const response = await apiRequest<PromoHealth>('/admin/stripe/first-purchase-promos/sync', {
        token,
        method: 'POST',
      })
      applyHealth(response)
      setMessage('synced')
      const codesResponse = await apiRequest<{ success?: boolean; data?: { items: PromoCode[] }; message?: string }>('/admin/stripe/promotion-codes', { token })
      setCodes(codesResponse.data?.items || [])
      if (codesResponse.success === false && codesResponse.message) {
        setError(codesResponse.message)
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao sincronizar com a Stripe')
    } finally {
      setSyncing(false)
    }
  }

  const createCoupon = async (event: FormEvent) => {
    event.preventDefault()
    if (!token) return
    try {
      setError('')
      await apiRequest('/admin/stripe/first-purchase-coupons', {
        token,
        method: 'POST',
        body: {
          term_months: term,
          code,
          name,
          max_redemptions: maxRedemptions,
          assign_first_purchase_slot: assignSlot,
        },
      })
      setMessage('created')
      setCode('')
      await load()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao criar cupom')
    }
  }

  const percent = term === 6 ? 40 : term === 3 ? 25 : 10

  return (
    <PageFrame title="Cupons de 1ª compra" description="O mapa prazo → promo_ fica no banco. A Stripe continua sendo a fonte do cupom cobrado.">
      <div className="muted-panel">
        Desconto de 1ª compra aplica-se somente à primeira fatura mensal. Nos planos de 3 e 6 meses, os meses seguintes cobram o preço cheio. O percentual maior (25%/40%) é benefício de compromisso, não desconto sobre o valor total do contrato.
      </div>
      {health && !health.complete ? (
        <div className="alert">Mapa incompleto ({health.missing_terms.map((item) => `${item}m`).join(', ')}). Checkout de cliente elegível fica bloqueado.</div>
      ) : null}
      {health && health.misconfig_count > 0 ? (
        <div className="warning">Misconfig count: {health.misconfig_count}</div>
      ) : null}
      {health?.missing_in_stripe?.length ? (
        <div className="warning">Não encontrados na Stripe: {health.missing_in_stripe.map((item) => `${item}m`).join(', ')}</div>
      ) : null}
      {health?.inactive?.length ? (
        <div className="warning">Inativos na Stripe: {health.inactive.map((item) => `${item}m`).join(', ')}</div>
      ) : null}
      {error ? <div className="alert">{error}</div> : null}
      {message ? <div className="success">{noticeCopy[message] || message}</div> : null}

      <Section title="Mapear slots" description="IDs persistidos no banco precisam começar com promo_ e existir na Stripe.">
        <div className="page-stack">
          <div className="inline-actions">
            <button className="ghost-button" type="button" onClick={() => void syncStripe()} disabled={syncing}>
              {syncing ? 'Sincronizando…' : 'Sincronizar com Stripe'}
            </button>
          </div>
          <form className="form-toolbar" onSubmit={saveMap}>
            <div className="form-grid">
              <label>1 mês(es) — 10%<input value={mapping[1]} onChange={(event) => setMapping((current) => ({ ...current, 1: event.target.value }))} placeholder="promo_..." /></label>
              <label>3 mês(es) — 25%<input value={mapping[3]} onChange={(event) => setMapping((current) => ({ ...current, 3: event.target.value }))} placeholder="promo_..." /></label>
              <label>6 mês(es) — 40%<input value={mapping[6]} onChange={(event) => setMapping((current) => ({ ...current, 6: event.target.value }))} placeholder="promo_..." /></label>
            </div>
            <div className="inline-actions">
              <button className="primary-button" type="submit">Salvar mapa</button>
            </div>
          </form>
        </div>
      </Section>

      <Section title="Criar na Stripe" description="Cria Coupon duration=once + Promotion Code first_time_transaction=true e grava o slot no banco. Percentual não é editável.">
        <form className="form-toolbar" onSubmit={createCoupon}>
          <div className="form-grid">
            <label>
              Prazo
              <select value={term} onChange={(event) => setTerm(Number(event.target.value))}>
                <option value={1}>1 mês — 10%</option>
                <option value={3}>3 meses — 25%</option>
                <option value={6}>6 meses — 40%</option>
              </select>
            </label>
            <label>Code<input value={code} onChange={(event) => setCode(event.target.value)} required /></label>
            <label>Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder={`First purchase ${term}m (${percent}%)`} /></label>
            <label>Max redemptions<input type="number" min={0} value={maxRedemptions} onChange={(event) => setMaxRedemptions(Number(event.target.value))} /></label>
            <label className="checkbox-field">
              <input type="checkbox" checked={assignSlot} onChange={(event) => setAssignSlot(event.target.checked)} />
              Assign first purchase slot
            </label>
          </div>
          <div className="inline-actions">
            <button className="primary-button" type="submit">Criar</button>
          </div>
        </form>
      </Section>

      <Section title="Promotion codes recentes" description="Até 25 códigos da Stripe.">
        <div className="table-shell table-scroll">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Promo id</th>
                <th>Coupon</th>
                <th>%</th>
                <th>Duration</th>
                <th>Ativo</th>
                <th>Slot</th>
                <th>Stripe</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((item) => (
                <tr key={item.id}>
                  <td>{item.code}</td>
                  <td>{item.id}</td>
                  <td>{item.coupon_id || '-'}</td>
                  <td>{item.percent_off == null ? '-' : `${item.percent_off}%`}</td>
                  <td>{formatPromoDuration(item.duration)}</td>
                  <td>{item.active ? 'Sim' : 'Não'}</td>
                  <td>{item.slot ? `${item.slot}m` : '-'}</td>
                  <td><a className="table-link" href={item.dashboard_url} target="_blank" rel="noreferrer">Abrir</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </PageFrame>
  )
}
