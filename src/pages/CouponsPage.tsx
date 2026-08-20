import { useEffect, useState, type FormEvent } from 'react'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'

type PromoHealth = {
  complete: boolean
  missing_terms: number[]
  mapping: Record<string, string | null>
  misconfig_count: number
  envSlots?: number[]
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

export function CouponsPage() {
  const { token } = useAuth()
  const [health, setHealth] = useState<PromoHealth | null>(null)
  const [mapping, setMapping] = useState({ 1: '', 3: '', 6: '' })
  const [codes, setCodes] = useState<PromoCode[]>([])
  const [term, setTerm] = useState(1)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [maxRedemptions, setMaxRedemptions] = useState(0)
  const [assignSlot, setAssignSlot] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    if (!token) return
    try {
      setError('')
      const [healthResponse, codesResponse] = await Promise.all([
        apiRequest<PromoHealth>('/admin/stripe/first-purchase-promos', { token }),
        apiRequest<{ success?: boolean; data?: { items: PromoCode[] }; message?: string }>('/admin/stripe/promotion-codes', { token }),
      ])
      setHealth(healthResponse)
      setMapping({
        1: healthResponse.mapping?.[1] || '',
        3: healthResponse.mapping?.[3] || '',
        6: healthResponse.mapping?.[6] || '',
      })
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
      const response = await apiRequest<PromoHealth>('/admin/stripe/first-purchase-promos', {
        token,
        method: 'PUT',
        body: mapping,
      })
      setHealth(response)
      setMessage('mapped')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao mapear')
    }
  }

  const createCoupon = async (event: FormEvent) => {
    event.preventDefault()
    if (!token) return
    try {
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
    <PageFrame title="Cupons de 1ª compra" description="Stripe é a fonte de verdade. O app só mapeia prazo → promo_.">
      <div className="muted-panel">
        Desconto de 1ª compra aplica-se somente à primeira fatura mensal. Nos planos de 3 e 6 meses, os meses seguintes cobram o preço cheio. O percentual maior (25%/40%) é benefício de compromisso, não desconto sobre o valor total do contrato.
      </div>
      {health && !health.complete ? (
        <div className="alert">Mapa incompleto ({health.missing_terms.map((item) => `${item}m`).join(', ')}). Checkout de cliente elegível fica bloqueado.</div>
      ) : null}
      {health && health.misconfig_count > 0 ? (
        <div className="warning">Misconfig count: {health.misconfig_count}</div>
      ) : null}
      {health?.envSlots?.length ? <div className="warning">Slots também definidos via env: {health.envSlots.join(', ')}m</div> : null}
      {error ? <div className="alert">{error}</div> : null}
      {message ? <div className="success">{message}</div> : null}

      <Section title="Mapear slots" description="IDs persistidos precisam começar com promo_.">
        <form className="form-grid" onSubmit={saveMap}>
          <label>1 mês(es) — 10%<input value={mapping[1]} onChange={(event) => setMapping((current) => ({ ...current, 1: event.target.value }))} placeholder="promo_..." /></label>
          <label>3 mês(es) — 25%<input value={mapping[3]} onChange={(event) => setMapping((current) => ({ ...current, 3: event.target.value }))} placeholder="promo_..." /></label>
          <label>6 mês(es) — 40%<input value={mapping[6]} onChange={(event) => setMapping((current) => ({ ...current, 6: event.target.value }))} placeholder="promo_..." /></label>
          <button className="primary-button" type="submit">Salvar mapa</button>
        </form>
      </Section>

      <Section title="Criar na Stripe" description="Coupon duration=once e first_time_transaction=true. Percentual não é editável.">
        <form className="form-grid" onSubmit={createCoupon}>
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
          <button className="primary-button" type="submit">Criar</button>
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
                  <td>{item.coupon_id ?? '-'}</td>
                  <td>{item.percent_off ?? '-'}</td>
                  <td>{item.duration ?? '-'}</td>
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
