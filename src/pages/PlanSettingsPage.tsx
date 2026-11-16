import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FiltersBar } from '../components/FiltersBar'
import { MarketSelect } from '../components/MarketSelect'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { ApiRequestError, apiRequest } from '../lib/api'
import { defaultMarket, sessionMarkets, type MarketCode } from '../lib/markets'

type PlanSettings = { market: string; planDays: number; largePackLimit: number; updatedAt: string | null }

type CatalogProducts = {
  items: Array<{ active: boolean; variants: Array<{ active?: boolean; weight?: string | null }> }>
}

// Same range as the API (plan-settings).
const MAX_LARGE_PACK_LIMIT = 60

type FieldErrors = { planDays?: string; largePackLimit?: string }

function wholeNumber(value: string) {
  return /^\d+$/.test(value.trim()) ? Number(value) : null
}

function validate(planDays: string, largePackLimit: string): FieldErrors {
  const errors: FieldErrors = {}
  const days = wholeNumber(planDays)
  if (days == null || days < 1) errors.planDays = 'Informe um número inteiro de dias, maior que zero.'
  const limit = wholeNumber(largePackLimit)
  if (limit == null || limit < 1 || limit > MAX_LARGE_PACK_LIMIT) {
    errors.largePackLimit = `Informe um número inteiro de 1 a ${MAX_LARGE_PACK_LIMIT}.`
  }
  return errors
}

function saveFailure(error: unknown): { fields: FieldErrors; message: string } {
  if (error instanceof ApiRequestError && error.code === 'plan_days_invalid') {
    return { fields: { planDays: 'A API recusou a duração: use um número inteiro maior que zero.' }, message: '' }
  }
  if (error instanceof ApiRequestError && error.code === 'large_pack_limit_invalid') {
    return { fields: { largePackLimit: `A API recusou o limite: use um número inteiro de 1 a ${MAX_LARGE_PACK_LIMIT}.` }, message: '' }
  }
  return { fields: {}, message: error instanceof Error ? error.message : 'Falha ao salvar o plano.' }
}

// Plan days and large-pack limit of one market (plan-settings), with the pack sizes the recommendation takes from
// the active variations of the market's published products.
export function PlanSettingsPage() {
  const { token, user, hasPermission } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const canWrite = hasPermission('catalog.write')
  const allowed = sessionMarkets(user)
  const requested = (searchParams.get('market') || '').toUpperCase() as MarketCode
  const market = allowed.includes(requested) ? requested : (defaultMarket(user) ?? '')
  const [saved, setSaved] = useState<PlanSettings | null>(null)
  const [planDays, setPlanDays] = useState('')
  const [largePackLimit, setLargePackLimit] = useState('')
  const [packWeights, setPackWeights] = useState<string[] | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const apply = (settings: PlanSettings) => {
    setSaved(settings)
    setPlanDays(String(settings.planDays))
    setLargePackLimit(String(settings.largePackLimit))
    setFieldErrors({})
  }

  useEffect(() => {
    if (!token || !market) return
    let cancelled = false
    setSaved(null)
    setPackWeights(null)
    setError('')
    setMessage('')
    apiRequest<PlanSettings>(`/admin/catalog/plan-settings?market=${encodeURIComponent(market)}`, { token })
      .then((settings) => { if (!cancelled) apply(settings) })
      .catch((requestError) => { if (!cancelled) setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar o plano.') })
    // The weights are a hint; the screen works without them.
    apiRequest<CatalogProducts>(`/admin/catalog/products?market=${encodeURIComponent(market)}&perPage=100`, { token })
      .then((catalog) => {
        if (cancelled) return
        const weights = catalog.items
          .filter((product) => product.active)
          .flatMap((product) => product.variants.filter((variant) => variant.active && variant.weight).map((variant) => String(variant.weight)))
        setPackWeights([...new Set(weights)])
      })
      .catch(() => { if (!cancelled) setPackWeights([]) })
    return () => {
      cancelled = true
    }
  }, [token, market])

  const dirty = Boolean(saved && (planDays !== String(saved.planDays) || largePackLimit !== String(saved.largePackLimit)))

  useEffect(() => {
    if (!dirty) return undefined
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !market || !canWrite || saving) return
    const errors = validate(planDays, largePackLimit)
    setFieldErrors(errors)
    setMessage('')
    if (errors.planDays || errors.largePackLimit) return
    try {
      setSaving(true)
      setError('')
      const settings = await apiRequest<PlanSettings>(`/admin/catalog/plan-settings?market=${encodeURIComponent(market)}`, {
        token,
        method: 'PUT',
        body: { planDays: Number(planDays), largePackLimit: Number(largePackLimit) },
      })
      apply(settings)
      setMessage('Plano salvo.')
    } catch (requestError) {
      const failure = saveFailure(requestError)
      setFieldErrors(failure.fields)
      setError(failure.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageFrame
      title="Plano"
      description="Duração da assinatura e limite do pacote pequeno da recomendação, por mercado. Valem para todos os produtos do mercado."
    >
      {error ? <div className="alert" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}

      <Section title="Filtros">
        <FiltersBar>
          <MarketSelect
            user={user}
            value={market}
            onChange={(value) => {
              if (dirty && !window.confirm('Há alterações não salvas no plano. Deseja descartar?')) return
              setSearchParams(value ? { market: value } : {})
            }}
          />
        </FiltersBar>
      </Section>

      <form onSubmit={save} noValidate>
        <Section title={`Plano ${market}`}>
          {saved ? (
            <>
              <div className="form-toolbar">
                <div className="form-grid plan-settings-grid">
                  <label>
                    Duração (dias)
                    <input
                      aria-label="Duração (dias)"
                      type="number"
                      min={1}
                      step={1}
                      value={planDays}
                      readOnly={!canWrite}
                      aria-invalid={fieldErrors.planDays ? true : undefined}
                      aria-describedby={fieldErrors.planDays ? 'plan-days-error' : undefined}
                      onChange={(event) => setPlanDays(event.target.value)}
                    />
                    {fieldErrors.planDays ? <span id="plan-days-error" className="field-hint warning-text">{fieldErrors.planDays}</span> : null}
                  </label>
                  <label>
                    Limite do pacote pequeno
                    <input
                      aria-label="Limite do pacote pequeno"
                      type="number"
                      min={1}
                      max={MAX_LARGE_PACK_LIMIT}
                      step={1}
                      value={largePackLimit}
                      readOnly={!canWrite}
                      aria-invalid={fieldErrors.largePackLimit ? true : undefined}
                      aria-describedby={fieldErrors.largePackLimit ? 'large-pack-limit-error' : 'large-pack-limit-hint'}
                      onChange={(event) => setLargePackLimit(event.target.value)}
                    />
                    {fieldErrors.largePackLimit
                      ? <span id="large-pack-limit-error" className="field-hint warning-text">{fieldErrors.largePackLimit}</span>
                      : (
                        <span id="large-pack-limit-hint" className="field-hint">
                          Acima de {largePackLimit || saved.largePackLimit} pacotes pequenos por mês, a recomendação passa ao pacote grande.
                        </span>
                      )}
                  </label>
                </div>
                {canWrite ? (
                  <div className="inline-actions">
                    <button className="primary-button" type="submit" disabled={saving || !dirty}>Salvar</button>
                  </div>
                ) : null}
              </div>
              <p className="field-hint">
                {packWeights == null
                  ? 'Carregando os pacotes da recomendação…'
                  : packWeights.length
                    ? `Pacotes na recomendação: ${packWeights.join(', ')} (variações ativas dos produtos publicados do mercado).`
                    : 'Sem variação ativa com peso: a recomendação usa 300 g e 500 g.'}
              </p>
              {dirty ? <p className="field-hint warning-text">Plano alterado. Salve antes de sair.</p> : null}
            </>
          ) : (!error ? <p className="muted">Carregando…</p> : null)}
        </Section>
      </form>
    </PageFrame>
  )
}
