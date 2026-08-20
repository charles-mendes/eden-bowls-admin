import { useEffect, useState, type FormEvent } from 'react'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'

type ShippingSettings = {
  br: {
    enabled: boolean
    label: string
    center: { name: string; street?: string; city?: string; state?: string; zipcode?: string; lat: number; lng: number; version?: string }
    rule: {
      per_km: number
      road_factor: number
      min_fee: number
      max_fee: number | null
      max_distance_km: number
      km_per_day: number
      min_days: number
      max_days: number
    }
  }
  us: { enabled: boolean; cost: number; carrier: string; delivery: string; label: string }
}

const emptySettings = (): ShippingSettings => ({
  br: {
    enabled: true,
    label: 'Entrega Eden Bowl',
    center: { name: 'CD', street: '', city: '', state: '', zipcode: '', lat: 0, lng: 0 },
    rule: { per_km: 0.95, road_factor: 1.3, min_fee: 0, max_fee: null, max_distance_km: 500, km_per_day: 80, min_days: 2, max_days: 10 },
  },
  us: { enabled: true, cost: 12.9, carrier: 'FedEx', delivery: '3–5 business days', label: 'FedEx 3–5 business days' },
})

export function ShippingPage() {
  const { token, hasPermission } = useAuth()
  const [tab, setTab] = useState<'BR' | 'US'>('BR')
  const [settings, setSettings] = useState<ShippingSettings>(emptySettings)
  const [zipCode, setZipCode] = useState('')
  const [testResult, setTestResult] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const canWrite = hasPermission('shipping.write')

  const load = async () => {
    if (!token) return
    try {
      setError('')
      const response = await apiRequest<{ success: boolean; data: { settings: ShippingSettings } }>('/admin/shipping/settings', { token })
      setSettings({ ...emptySettings(), ...response.data.settings })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar frete')
    }
  }

  useEffect(() => {
    void load()
  }, [token])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!token) return
    try {
      setError('')
      const response = await apiRequest<{ success: boolean; data: { settings: ShippingSettings } }>('/admin/shipping/settings', {
        token,
        method: 'PUT',
        body: settings,
      })
      setSettings({ ...emptySettings(), ...response.data.settings })
      setMessage('Settings saved.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao salvar')
    }
  }

  const testZip = async (event: FormEvent) => {
    event.preventDefault()
    if (!token) return
    try {
      setError('')
      const response = await apiRequest<{ success: boolean; data: { distance: number; shipping: number; delivery_days: number; distance_source: string; breakdown?: { minimum_applied?: boolean } } }>('/admin/shipping/test', {
        token,
        method: 'POST',
        body: { zipCode, country: 'BR' },
      })
      const data = response.data
      setTestResult(`${data.shipping} BRL · ${data.distance} km (${data.distance_source}) · ${data.delivery_days} dias${data.breakdown?.minimum_applied ? ' · piso aplicado' : ''}`)
    } catch (requestError) {
      setTestResult('')
      setError(requestError instanceof Error ? requestError.message : 'Falha no teste de CEP')
    }
  }

  return (
    <PageFrame title="Frete" description="Configuração BR (por km) e US (taxa fixa), persistida no banco.">
      {error ? <div className="alert">{error}</div> : null}
      {message ? <div className="success">{message}</div> : null}

      <div className="tabs">
        <button type="button" className={tab === 'BR' ? 'tab active' : 'tab'} onClick={() => setTab('BR')}>Brasil</button>
        <button type="button" className={tab === 'US' ? 'tab active' : 'tab'} onClick={() => setTab('US')}>United States</button>
      </div>

      <form className="editor-card" onSubmit={save}>
        {tab === 'BR' ? (
          <div className="form-grid">
            <label className="checkbox-field">
              <input type="checkbox" checked={settings.br.enabled} onChange={(event) => setSettings((current) => ({ ...current, br: { ...current.br, enabled: event.target.checked } }))} />
              Habilitado
            </label>
            <label>Rótulo<input value={settings.br.label} onChange={(event) => setSettings((current) => ({ ...current, br: { ...current.br, label: event.target.value } }))} /></label>
            <label>CD nome<input value={settings.br.center.name} onChange={(event) => setSettings((current) => ({ ...current, br: { ...current.br, center: { ...current.br.center, name: event.target.value } } }))} /></label>
            <label>Latitude<input type="number" step="0.000001" value={settings.br.center.lat} onChange={(event) => setSettings((current) => ({ ...current, br: { ...current.br, center: { ...current.br.center, lat: Number(event.target.value) } } }))} /></label>
            <label>Longitude<input type="number" step="0.000001" value={settings.br.center.lng} onChange={(event) => setSettings((current) => ({ ...current, br: { ...current.br, center: { ...current.br.center, lng: Number(event.target.value) } } }))} /></label>
            <label>R$/km<input type="number" step="0.01" value={settings.br.rule.per_km} onChange={(event) => setSettings((current) => ({ ...current, br: { ...current.br, rule: { ...current.br.rule, per_km: Number(event.target.value) } } }))} /></label>
            <label>Road factor<input type="number" step="0.01" value={settings.br.rule.road_factor} onChange={(event) => setSettings((current) => ({ ...current, br: { ...current.br, rule: { ...current.br.rule, road_factor: Number(event.target.value) } } }))} /></label>
            <label>Piso<input type="number" step="0.01" value={settings.br.rule.min_fee} onChange={(event) => setSettings((current) => ({ ...current, br: { ...current.br, rule: { ...current.br.rule, min_fee: Number(event.target.value) } } }))} /></label>
            <label>Teto<input value={settings.br.rule.max_fee ?? ''} onChange={(event) => setSettings((current) => ({ ...current, br: { ...current.br, rule: { ...current.br.rule, max_fee: event.target.value === '' ? null : Number(event.target.value) } } }))} /></label>
            <label>Max km<input type="number" value={settings.br.rule.max_distance_km} onChange={(event) => setSettings((current) => ({ ...current, br: { ...current.br, rule: { ...current.br.rule, max_distance_km: Number(event.target.value) } } }))} /></label>
            <label>Km/dia<input type="number" value={settings.br.rule.km_per_day} onChange={(event) => setSettings((current) => ({ ...current, br: { ...current.br, rule: { ...current.br.rule, km_per_day: Number(event.target.value) } } }))} /></label>
            <label>Mín. dias<input type="number" value={settings.br.rule.min_days} onChange={(event) => setSettings((current) => ({ ...current, br: { ...current.br, rule: { ...current.br.rule, min_days: Number(event.target.value) } } }))} /></label>
            <label>Máx. dias<input type="number" value={settings.br.rule.max_days} onChange={(event) => setSettings((current) => ({ ...current, br: { ...current.br, rule: { ...current.br.rule, max_days: Number(event.target.value) } } }))} /></label>
          </div>
        ) : (
          <div className="form-grid">
            <label className="checkbox-field">
              <input type="checkbox" checked={settings.us.enabled} onChange={(event) => setSettings((current) => ({ ...current, us: { ...current.us, enabled: event.target.checked } }))} />
              Enabled (bloqueia a rate na loja se desmarcado)
            </label>
            <label>Cost<input type="number" step="0.01" value={settings.us.cost} onChange={(event) => setSettings((current) => ({ ...current, us: { ...current.us, cost: Number(event.target.value) } }))} /></label>
            <label>Carrier<input value={settings.us.carrier} onChange={(event) => setSettings((current) => ({ ...current, us: { ...current.us, carrier: event.target.value } }))} /></label>
            <label>Delivery<input value={settings.us.delivery} onChange={(event) => setSettings((current) => ({ ...current, us: { ...current.us, delivery: event.target.value } }))} /></label>
            <label>Label<input value={settings.us.label} onChange={(event) => setSettings((current) => ({ ...current, us: { ...current.us, label: event.target.value } }))} /></label>
          </div>
        )}
        {canWrite ? <button className="primary-button" type="submit">Salvar</button> : null}
      </form>

      {tab === 'BR' ? (
        <Section title="Teste de CEP" description="Mesmo motor da loja, sem rate limit extra.">
          <form className="inline-actions" onSubmit={testZip}>
            <input value={zipCode} onChange={(event) => setZipCode(event.target.value)} placeholder="01310-100" />
            <button className="primary-button" type="submit">Testar</button>
          </form>
          {testResult ? <div className="muted-panel">{testResult}</div> : null}
        </Section>
      ) : null}
    </PageFrame>
  )
}
