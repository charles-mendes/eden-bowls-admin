import { useEffect, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Dialog } from '../components/Dialog'
import { HeadquartersCard } from '../components/shipping/HeadquartersCard'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { ApiRequestError, apiRequest } from '../lib/api'
import { defaultMarket, hasBothMarkets } from '../lib/markets'
import {
  UPS_SERVICES,
  brHeadquartersReady,
  emptySettings,
  formatMoney,
  mergeSettings,
  usHeadquartersReady,
  type ShippingSettings,
  type UpsSimulation,
} from '../lib/shippingSettings'

type SettingsResponse = { success: boolean; data: { settings: Partial<ShippingSettings> } }

type BrQuote = {
  distance: number
  shipping: number
  distance_source?: string
  breakdown?: { minimum_applied?: boolean; maximum_applied?: boolean }
  destination?: { city?: string; state?: string; zipcode?: string }
}

type FixedQuote = { shipping: number; label?: string; carrier?: string; delivery?: string }

type UsTestResult = { quote_mode: 'fixed' | 'ups'; fixed: FixedQuote | null; ups: UpsSimulation }

const STEP_ICON: Record<string, string> = { ok: '✓', error: '✕', warning: '!', skipped: '–' }

function NumberField({
  label,
  hint,
  value,
  onChange,
  step = '0.01',
  prefix,
  suffix,
  allowEmpty,
  disabled,
}: {
  label: string
  hint?: ReactNode
  value: number | null
  onChange: (value: number | null) => void
  step?: string
  prefix?: string
  suffix?: string
  allowEmpty?: boolean
  disabled?: boolean
}) {
  return (
    <label className="ship-field">
      <span>{label}</span>
      <span className="ship-affix">
        {prefix ? <em>{prefix}</em> : null}
        <input
          type="number"
          step={step}
          min="0"
          value={value ?? ''}
          disabled={disabled}
          placeholder={allowEmpty ? 'Sem limite' : undefined}
          onChange={(event) => onChange(event.target.value === '' ? (allowEmpty ? null : 0) : Number(event.target.value))}
        />
        {suffix ? <em>{suffix}</em> : null}
      </span>
      {hint ? <small className="ship-hint">{hint}</small> : null}
    </label>
  )
}

function TextField({ label, hint, value, onChange, disabled }: { label: string; hint?: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <label className="ship-field">
      <span>{label}</span>
      <input value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
      {hint ? <small className="ship-hint">{hint}</small> : null}
    </label>
  )
}

function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (value: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  return (
    <label className="ship-toggle">
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className="ship-toggle-track" aria-hidden="true" />
      <span>
        <strong>{label}</strong>
        {description ? <small className="ship-hint">{description}</small> : null}
      </span>
    </label>
  )
}

function brQuoteError(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.code === 'out_of_coverage') {
      const distance = Number(error.details?.distance)
      return `Fora do raio de entrega${Number.isFinite(distance) ? `: ${distance.toFixed(1)} km da sede` : ''}.`
    }
    if (error.code === 'zipcode_not_found') return 'CEP não encontrado.'
    if (error.code === 'invalid_zipcode') return 'Informe um CEP com 8 dígitos.'
    if (error.code === 'route_failed') return 'Cadastre o endereço da sede do Brasil antes de simular.'
  }
  return error instanceof Error ? error.message : 'Falha na simulação'
}

type ShippingTab = 'regras' | 'sede' | 'simulador'

const TABS: Array<{ id: ShippingTab; label: string }> = [
  { id: 'regras', label: 'Regras de entrega' },
  { id: 'sede', label: 'Sede' },
  { id: 'simulador', label: 'Simulador' },
]

const MARKET_NAME: Record<'BR' | 'US', string> = { BR: 'Brasil', US: 'EUA' }
const RULES_OF: Record<'BR' | 'US', string> = { BR: 'do Brasil', US: 'dos EUA' }

// The rules each market saves; headquarters addresses are saved from their own card.
function rulesOf(settings: ShippingSettings, market: 'BR' | 'US') {
  if (market === 'BR') return { enabled: settings.br.enabled, label: settings.br.label, rule: settings.br.rule }
  const { us } = settings
  return {
    enabled: us.enabled,
    cost: us.cost,
    carrier: us.carrier,
    delivery: us.delivery,
    label: us.label,
    quote_mode: us.quote_mode,
    fallback_enabled: us.fallback_enabled,
    package: us.package,
    allowed_service_codes: us.allowed_service_codes,
  }
}

function headquartersReady(settings: ShippingSettings, market: 'BR' | 'US') {
  return market === 'BR' ? brHeadquartersReady(settings.br.center) : usHeadquartersReady(settings.us.ship_from)
}

export function ShippingPage() {
  const { token, user, hasPermission } = useAuth()
  const bothMarkets = hasBothMarkets(user)
  const canWrite = hasPermission('shipping.write')
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedMarket = searchParams.get('mercado') === 'us' ? 'US' : 'BR'
  const market: 'BR' | 'US' = bothMarkets ? requestedMarket : (defaultMarket(user) ?? 'BR')
  // Daily use is the simulator; people who can edit land on the rules.
  const defaultTab: ShippingTab = canWrite ? 'regras' : 'simulador'
  const requestedTab = searchParams.get('aba')
  const tab: ShippingTab = TABS.some((option) => option.id === requestedTab) ? requestedTab as ShippingTab : defaultTab

  const [settings, setSettings] = useState<ShippingSettings>(emptySettings)
  const [saved, setSaved] = useState<ShippingSettings>(emptySettings)
  const [loaded, setLoaded] = useState(false)
  const [zipCode, setZipCode] = useState('')
  const [testing, setTesting] = useState(false)
  const [brResult, setBrResult] = useState<BrQuote | null>(null)
  const [usResult, setUsResult] = useState<UsTestResult | null>(null)
  const [testError, setTestError] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pendingMarket, setPendingMarket] = useState<'BR' | 'US' | null>(null)
  const [saving, setSaving] = useState(false)

  const dirty = loaded && JSON.stringify(rulesOf(settings, market)) !== JSON.stringify(rulesOf(saved, market))
  const savedHqReady = headquartersReady(saved, market)
  const simulatorNeedsHq = market === 'BR' || saved.us.quote_mode === 'ups'

  const load = async () => {
    if (!token) return
    try {
      setError('')
      const response = await apiRequest<SettingsResponse>('/admin/shipping/settings', { token })
      const next = mergeSettings(response.data.settings)
      setSettings(next)
      setSaved(next)
      setLoaded(true)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar frete')
    }
  }

  useEffect(() => {
    void load()
  }, [token])

  const updateBr = (patch: Partial<ShippingSettings['br']>) => setSettings((current) => ({ ...current, br: { ...current.br, ...patch } }))
  const updateBrRule = (patch: Partial<ShippingSettings['br']['rule']>) => setSettings((current) => ({ ...current, br: { ...current.br, rule: { ...current.br.rule, ...patch } } }))
  const updateUs = (patch: Partial<ShippingSettings['us']>) => setSettings((current) => ({ ...current, us: { ...current.us, ...patch } }))
  const updatePackage = (patch: Partial<ShippingSettings['us']['package']>) => setSettings((current) => ({ ...current, us: { ...current.us, package: { ...current.us.package, ...patch } } }))

  const toggleService = (code: string, on: boolean) => {
    const current = settings.us.allowed_service_codes
    const next = on ? [...current, code] : current.filter((item) => item !== code)
    updateUs({ allowed_service_codes: UPS_SERVICES.map(([item]) => item).filter((item) => next.includes(item)) })
  }

  const setParam = (key: 'aba' | 'mercado', value: string | null) => {
    setSearchParams((params) => {
      if (value) params.set(key, value)
      else params.delete(key)
      return params
    })
  }

  const selectTab = (next: ShippingTab) => {
    setParam('aba', next === defaultTab ? null : next)
  }

  // Arrow keys move between tabs, following the WAI-ARIA tabs pattern.
  const moveTabFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    const index = TABS.findIndex((option) => option.id === tab)
    const next = TABS[(index + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].id
    selectTab(next)
    document.getElementById(`shipping-tab-${next}`)?.focus()
  }

  const switchMarket = (next: 'BR' | 'US') => {
    setParam('mercado', next === 'US' ? 'us' : null)
    setZipCode('')
    setBrResult(null)
    setUsResult(null)
    setTestError('')
    setMessage('')
    setPendingMarket(null)
  }

  // Switching market with unsaved rules asks first, so edits are neither lost nor saved to the wrong market.
  const requestMarket = (next: 'BR' | 'US') => {
    if (next === market) return
    if (dirty) setPendingMarket(next)
    else switchMarket(next)
  }

  const discardRules = () => {
    setSettings((current) => (market === 'BR'
      ? { ...current, br: { ...saved.br, center: current.br.center } }
      : { ...current, us: { ...saved.us, ship_from: current.us.ship_from } }))
  }

  const saveRules = async () => {
    if (!token) return false
    try {
      setSaving(true)
      setError('')
      setMessage('')
      const response = await apiRequest<SettingsResponse>('/admin/shipping/settings', {
        token,
        method: 'PUT',
        body: market === 'BR' ? { br: rulesOf(settings, 'BR') } : { us: rulesOf(settings, 'US') },
      })
      const next = mergeSettings(response.data.settings)
      setSaved(next)
      setSettings((current) => (market === 'BR' ? { ...current, br: { ...next.br } } : { ...current, us: { ...next.us } }))
      setMessage(market === 'BR' ? 'Regras do Brasil salvas.' : 'Regras dos Estados Unidos salvas.')
      return true
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao salvar')
      return false
    } finally {
      setSaving(false)
    }
  }

  const save = (event: FormEvent) => {
    event.preventDefault()
    void saveRules()
  }

  const testZip = async (event: FormEvent) => {
    event.preventDefault()
    if (!token) return
    setTesting(true)
    setTestError('')
    setBrResult(null)
    setUsResult(null)
    try {
      const response = await apiRequest<{ success: boolean; data: BrQuote | UsTestResult }>('/admin/shipping/test', {
        token,
        method: 'POST',
        body: { zipCode, country: market },
      })
      if (market === 'US') setUsResult(response.data as UsTestResult)
      else setBrResult(response.data as BrQuote)
    } catch (requestError) {
      setTestError(market === 'BR' ? brQuoteError(requestError) : (requestError instanceof Error ? requestError.message : 'Falha na simulação'))
    } finally {
      setTesting(false)
    }
  }

  const br = settings.br
  const us = settings.us
  const upsMode = us.quote_mode === 'ups'

  return (
    <PageFrame
      title="Frete"
      description="Regras de entrega, sede e simulação de frete do mercado escolhido."
      actions={bothMarkets ? (
        <div className="segmented" role="group" aria-label="Mercado">
          {(['BR', 'US'] as const).map((option) => (
            <button key={option} type="button" aria-pressed={market === option} className={market === option ? 'active' : ''} onClick={() => requestMarket(option)}>
              {MARKET_NAME[option]}
            </button>
          ))}
        </div>
      ) : undefined}
    >
      {error ? <div className="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}

      <div className="page-tabs" role="tablist" aria-label="Frete" onKeyDown={moveTabFocus}>
        {TABS.map((option) => (
          <button
            key={option.id}
            id={`shipping-tab-${option.id}`}
            type="button"
            role="tab"
            aria-selected={tab === option.id}
            aria-controls={`shipping-panel-${option.id}`}
            tabIndex={tab === option.id ? 0 : -1}
            className={tab === option.id ? 'page-tab active' : 'page-tab'}
            onClick={() => selectTab(option.id)}
          >
            {option.label}
            {option.id === 'regras' && dirty ? <span className="page-tab-flag">não salvo</span> : null}
            {option.id === 'sede' && loaded && !savedHqReady ? <span className="page-tab-flag">pendente</span> : null}
          </button>
        ))}
      </div>

      {tab === 'regras' && !loaded ? (
        <p id="shipping-panel-regras" role="tabpanel" aria-labelledby="shipping-tab-regras" className="muted" aria-busy="true">Carregando…</p>
      ) : null}

      {tab === 'regras' && loaded ? (
        <form id="shipping-panel-regras" role="tabpanel" aria-labelledby="shipping-tab-regras" className="ship-rules" onSubmit={save}>
          {market === 'BR' ? (
            <Section title="Entrega local" description="Entrega própria, avulsa, no mesmo dia do preparo.">
              <div className="ship-summary">
                <div><small>Raio</small><strong>{br.rule.max_distance_km} km</strong></div>
                <div><small>Valor por km</small><strong>{formatMoney(br.rule.per_km, 'BRL')}</strong></div>
                <div><small>Prazo</small><strong>Mesmo dia</strong></div>
              </div>
              <Toggle checked={br.enabled} disabled={!canWrite} onChange={(enabled) => updateBr({ enabled })} label="Entrega no Brasil ativa" description="Desligada, a loja não cota frete para CEPs brasileiros." />
              <div className="ship-fields">
                <NumberField label="Raio de entrega" suffix="km" step="1" disabled={!canWrite} value={br.rule.max_distance_km} onChange={(value) => updateBrRule({ max_distance_km: value ?? 0 })} hint="Clientes mais longe que isso da sede não conseguem assinar." />
                <NumberField label="Valor por km" prefix="R$" disabled={!canWrite} value={br.rule.per_km} onChange={(value) => updateBrRule({ per_km: value ?? 0 })} hint={`Ex.: 10 km custam ${formatMoney(br.rule.per_km * 10, 'BRL')}.`} />
                <TextField label="Nome exibido na loja" disabled={!canWrite} value={br.label} onChange={(label) => updateBr({ label })} />
              </div>
              <details className="ship-advanced">
                <summary>Ajustes avançados</summary>
                <div className="ship-fields">
                  <NumberField label="Taxa mínima" prefix="R$" disabled={!canWrite} value={br.rule.min_fee} onChange={(value) => updateBrRule({ min_fee: value ?? 0 })} hint="Cobrada em entregas muito perto, quando km × valor fica abaixo dela. 0 desliga." />
                  <NumberField label="Taxa máxima" prefix="R$" allowEmpty disabled={!canWrite} value={br.rule.max_fee} onChange={(value) => updateBrRule({ max_fee: value })} hint="Limite de frete. Vazio = sem limite." />
                  <NumberField label="Fator de correção" suffix="×" disabled={!canWrite} value={br.rule.road_factor} onChange={(value) => updateBrRule({ road_factor: value ?? 1 })} hint="Usado só quando o cálculo de rota falha: distância em linha reta × fator." />
                </div>
              </details>
            </Section>
          ) : (
            <>
              <Section title="Modo de cotação" description="Como a loja calcula o frete para os Estados Unidos.">
                <Toggle checked={us.enabled} disabled={!canWrite} onChange={(enabled) => updateUs({ enabled })} label="Entrega nos EUA ativa" />
                <div className="ship-mode-grid" role="radiogroup" aria-label="Modo de cotação">
                  <label className={upsMode ? 'ship-mode active' : 'ship-mode'}>
                    <input type="radio" name="quote_mode" checked={upsMode} disabled={!canWrite} onChange={() => updateUs({ quote_mode: 'ups' })} />
                    <strong>UPS</strong>
                    <small>Cotação em tempo real pela API da UPS, usando o endereço do cliente.</small>
                  </label>
                  <label className={!upsMode ? 'ship-mode active' : 'ship-mode'}>
                    <input type="radio" name="quote_mode" checked={!upsMode} disabled={!canWrite} onChange={() => updateUs({ quote_mode: 'fixed' })} />
                    <strong>Valor fixo</strong>
                    <small>O mesmo valor para qualquer ZIP.</small>
                  </label>
                </div>
              </Section>

              {upsMode ? (
                <Section title="UPS" description="A UPS calcula valor e prazo pelo endereço. Credenciais ficam no servidor.">
                  <fieldset className="ship-fieldset">
                    <legend>Serviços aceitos</legend>
                    <div className="ship-chips">
                      {UPS_SERVICES.map(([code, label]) => (
                        <label key={code} className={us.allowed_service_codes.includes(code) ? 'ship-chip active' : 'ship-chip'}>
                          <input type="checkbox" disabled={!canWrite} checked={us.allowed_service_codes.includes(code)} onChange={(event) => toggleService(code, event.target.checked)} />
                          {label}
                        </label>
                      ))}
                    </div>
                    <small className="ship-hint">O checkout usa UPS Ground quando aceito; senão, o serviço aceito mais barato.</small>
                  </fieldset>
                  <fieldset className="ship-fieldset">
                    <legend>Caixa padrão</legend>
                    <div className="ship-fields ship-fields-4">
                      <NumberField label="Peso" suffix="lb" step="0.1" disabled={!canWrite} value={us.package.weight_lb} onChange={(value) => updatePackage({ weight_lb: value ?? 0 })} />
                      <NumberField label="Comprimento" suffix="in" step="0.1" disabled={!canWrite} value={us.package.length_in} onChange={(value) => updatePackage({ length_in: value ?? 0 })} />
                      <NumberField label="Largura" suffix="in" step="0.1" disabled={!canWrite} value={us.package.width_in} onChange={(value) => updatePackage({ width_in: value ?? 0 })} />
                      <NumberField label="Altura" suffix="in" step="0.1" disabled={!canWrite} value={us.package.height_in} onChange={(value) => updatePackage({ height_in: value ?? 0 })} />
                    </div>
                  </fieldset>
                  <Toggle checked={us.fallback_enabled} disabled={!canWrite} onChange={(fallback_enabled) => updateUs({ fallback_enabled })} label="Se a UPS falhar, cobrar valor fixo" description="Sem isso, o cliente não consegue fechar o pedido enquanto a UPS estiver fora." />
                </Section>
              ) : null}

              {!upsMode || us.fallback_enabled ? (
                <Section title={upsMode ? 'Valor de reserva' : 'Valor fixo'} description={upsMode ? 'Usado só quando a UPS não responde.' : 'Cobrado em todo pedido dos Estados Unidos.'}>
                  <div className="ship-fields">
                    <NumberField label="Valor" prefix="US$" disabled={!canWrite} value={us.cost} onChange={(value) => updateUs({ cost: value ?? 0 })} />
                    <TextField label="Transportadora" disabled={!canWrite} value={us.carrier} onChange={(carrier) => updateUs({ carrier })} />
                    <TextField label="Prazo exibido" hint="Ex.: 3–5 business days" disabled={!canWrite} value={us.delivery} onChange={(delivery) => updateUs({ delivery })} />
                    <TextField label="Nome exibido na loja" disabled={!canWrite} value={us.label} onChange={(label) => updateUs({ label })} />
                  </div>
                </Section>
              ) : null}
            </>
          )}
          {canWrite ? (
            <div className="ship-actions ship-save-bar">
              {dirty ? <span className="ship-hint">Alterações não salvas.</span> : null}
              <button className="primary-button" type="submit" disabled={saving}>{market === 'BR' ? 'Salvar regras do Brasil' : 'Salvar regras dos EUA'}</button>
            </div>
          ) : null}
        </form>
      ) : null}

      {tab === 'sede' ? (
        <div id="shipping-panel-sede" role="tabpanel" aria-labelledby="shipping-tab-sede" className="ship-panel">
          {loaded ? (
            <HeadquartersCard
              key={market}
              market={market}
              settings={settings}
              token={token}
              canWrite={canWrite}
              onSaved={(next, text) => {
                const merged = mergeSettings(next)
                setSaved(merged)
                // Keep unsaved rule edits: take only the address the card saved.
                setSettings((current) => ({
                  ...current,
                  br: { ...current.br, center: merged.br.center },
                  us: { ...current.us, ship_from: merged.us.ship_from },
                }))
                setError('')
                setMessage(text)
              }}
            />
          ) : <p className="muted">Carregando…</p>}
        </div>
      ) : null}

      {tab === 'simulador' ? (
        <div id="shipping-panel-simulador" role="tabpanel" aria-labelledby="shipping-tab-simulador" className="ship-panel ship-simulator">
          <Section
            title={market === 'US' ? 'Simular frete por ZIP' : 'Simular frete por CEP'}
            description={market === 'US'
              ? 'Usa as regras salvas dos EUA e roda todas as chamadas da UPS no sandbox (CIE). Nada é cobrado.'
              : 'Usa as regras salvas do Brasil: mesmo cálculo da loja, a partir da sede.'}
            actions={market === 'US' ? <span className="badge-info">UPS sandbox</span> : undefined}
          >
            {dirty ? (
              <div className="warning ship-notice">
                <span>Há alterações não salvas nas regras {RULES_OF[market]}. A simulação usa as regras salvas.</span>
                <button type="button" className="link-button" onClick={() => selectTab('regras')}>Ir para Regras</button>
              </div>
            ) : null}
            {loaded && simulatorNeedsHq && !savedHqReady ? (
              <div className="warning ship-notice">
                <span>A sede {market === 'BR' ? 'do Brasil' : 'dos EUA'} não tem endereço validado. {market === 'BR' ? 'Sem ela, o frete não é calculado.' : 'Sem ela, a UPS não cota.'}</span>
                <button type="button" className="link-button" onClick={() => selectTab('sede')}>{canWrite ? 'Cadastrar sede' : 'Ver sede'}</button>
              </div>
            ) : null}
            <form className="ship-sim-form" onSubmit={testZip}>
              <input
                aria-label={market === 'US' ? 'ZIP code' : 'CEP'}
                value={zipCode}
                onChange={(event) => setZipCode(event.target.value)}
                placeholder={market === 'US' ? '94105' : '01310-100'}
                inputMode="numeric"
              />
              <button className="primary-button" type="submit" disabled={testing || !zipCode.trim()}>{testing ? 'Simulando…' : 'Simular'}</button>
            </form>

            {testError ? <div className="alert ship-sim-alert">{testError}</div> : null}

            {brResult ? (
              <div className="ship-result">
                <div className="ship-result-total">
                  <small>Frete</small>
                  <strong>{formatMoney(brResult.shipping, 'BRL')}</strong>
                  {brResult.breakdown?.minimum_applied ? <span className="badge-warning">taxa mínima aplicada</span> : null}
                  {brResult.breakdown?.maximum_applied ? <span className="badge-warning">taxa máxima aplicada</span> : null}
                </div>
                <dl className="ship-result-list">
                  <dt>Destino</dt><dd>{[brResult.destination?.city, brResult.destination?.state].filter(Boolean).join('/') || '—'}</dd>
                  <dt>Distância</dt><dd>{brResult.distance} km {brResult.distance_source === 'osrm' ? 'de rota' : '(linha reta corrigida)'}</dd>
                  <dt>Entrega</dt><dd>No mesmo dia do preparo</dd>
                </dl>
              </div>
            ) : null}

            {usResult ? (
              <div className="ship-result">
                {usResult.fixed ? (
                  <div className="ship-result-total">
                    <small>Checkout (valor fixo)</small>
                    <strong>{formatMoney(usResult.fixed.shipping, 'USD')}</strong>
                    <span className="ship-hint">A loja usa valor fixo; a UPS abaixo é só comparação.</span>
                  </div>
                ) : usResult.ups.selected ? (
                  <div className="ship-result-total">
                    <small>Checkout (UPS)</small>
                    <strong>{formatMoney(usResult.ups.selected.amount, 'USD')}</strong>
                    <span className="ship-hint">{usResult.ups.selected.label}{usResult.ups.selected.delivery_days ? ` · ${usResult.ups.selected.delivery_days} dia(s) úteis` : ''}</span>
                  </div>
                ) : null}

                <ol className="ship-steps" aria-label="Chamadas UPS">
                  {usResult.ups.steps.map((step) => (
                    <li key={step.key} className={`ship-step ship-step-${step.status}`}>
                      <span className="ship-step-icon" aria-hidden="true">{STEP_ICON[step.status]}</span>
                      <div>
                        <strong>{step.label}</strong>
                        {step.detail ? <small>{step.detail}</small> : null}
                      </div>
                      {step.ms != null ? <small className="ship-step-ms">{step.ms} ms</small> : null}
                    </li>
                  ))}
                </ol>

                {usResult.ups.rates.length ? (
                  <table className="ship-rates">
                    <thead>
                      <tr><th>Serviço</th><th>Valor</th><th>Prazo</th></tr>
                    </thead>
                    <tbody>
                      {usResult.ups.rates.map((rate) => {
                        const used = !usResult.fixed && usResult.ups.selected?.service_code === rate.service_code
                        return (
                        <tr key={rate.service_code} className={used ? 'selected' : rate.allowed ? '' : 'disabled'}>
                          <td>
                            {rate.label}
                            {used ? <span className="badge-success">checkout</span> : null}
                            {!rate.allowed ? <span className="ship-hint"> não aceito</span> : null}
                          </td>
                          <td>{formatMoney(rate.amount, 'USD')}</td>
                          <td>{rate.delivery_days ? `${rate.delivery_days} d` : '—'}</td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : null}
              </div>
            ) : null}
          </Section>
        </div>
      ) : null}

      <Dialog
        title="Alterações não salvas"
        open={Boolean(pendingMarket)}
        onClose={() => setPendingMarket(null)}
        footer={(
          <>
            <button className="ghost-button" type="button" onClick={() => setPendingMarket(null)}>Continuar editando</button>
            <button
              className="danger-button"
              type="button"
              onClick={() => {
                const next = pendingMarket
                discardRules()
                if (next) switchMarket(next)
              }}
            >
              Descartar e trocar
            </button>
            {canWrite ? (
              <button
                className="primary-button"
                type="button"
                disabled={saving}
                onClick={async () => {
                  const next = pendingMarket
                  if (await saveRules() && next) switchMarket(next)
                }}
              >
                Salvar e trocar
              </button>
            ) : null}
          </>
        )}
      >
        <p>Você tem alterações não salvas nas regras {RULES_OF[market]}. Salve ou descarte antes de abrir {pendingMarket ? MARKET_NAME[pendingMarket] : ''}.</p>
      </Dialog>
    </PageFrame>
  )
}
