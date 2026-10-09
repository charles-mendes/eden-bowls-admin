import { useState, type FormEvent, type ReactNode } from 'react'
import { ApiRequestError, apiRequest } from '../../lib/api'
import {
  BR_STATES,
  US_STATES,
  brHeadquartersReady,
  usHeadquartersReady,
  type BrCenter,
  type HeadquartersValidation,
  type ShippingSettings,
  type UsShipFrom,
} from '../../lib/shippingSettings'

type Market = 'BR' | 'US'
type Draft = Record<string, string>

const BR_ADDRESS_KEYS = ['zipcode', 'street', 'number', 'complement', 'neighborhood', 'city', 'state']
const US_ADDRESS_KEYS = ['street', 'street2', 'city', 'state', 'zipcode']

function draftFrom(market: Market, settings: ShippingSettings): Draft {
  if (market === 'BR') {
    const { name, street, number, complement, neighborhood, city, state, zipcode } = settings.br.center
    return { name, street, number, complement, neighborhood, city, state, zipcode }
  }
  const { name, street, street2, city, state, zipcode } = settings.us.ship_from
  return { name, street, street2, city, state, zipcode }
}

function addressKey(market: Market, draft: Draft) {
  return (market === 'BR' ? BR_ADDRESS_KEYS : US_ADDRESS_KEYS).map((key) => (draft[key] || '').trim().toLowerCase()).join('|')
}

function brLines(center: BrCenter) {
  const first = [center.street, center.number].filter(Boolean).join(', ')
  return [
    [first, center.complement].filter(Boolean).join(' – '),
    [center.neighborhood, [center.city, center.state].filter(Boolean).join('/')].filter(Boolean).join(' · '),
    center.zipcode ? `CEP ${center.zipcode}` : '',
  ].filter(Boolean)
}

function usLines(shipFrom: UsShipFrom) {
  return [
    shipFrom.street,
    shipFrom.street2,
    [shipFrom.city, [shipFrom.state, shipFrom.zipcode].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    'United States',
  ].filter(Boolean)
}

function Field({ label, error, hint, wide, children }: { label: string; error?: string; hint?: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={wide ? 'ship-field ship-field-wide' : 'ship-field'}>
      <span>{label}</span>
      {children}
      {error ? <small className="ship-field-error">{error}</small> : hint ? <small className="ship-hint">{hint}</small> : null}
    </label>
  )
}

export function HeadquartersCard({
  market,
  settings,
  token,
  canWrite,
  onSaved,
}: {
  market: Market
  settings: ShippingSettings
  token: string | null
  canWrite: boolean
  onSaved: (settings: Partial<ShippingSettings>, message: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => draftFrom(market, settings))
  const [validation, setValidation] = useState<HeadquartersValidation | null>(null)
  const [validatedKey, setValidatedKey] = useState('')
  const [busy, setBusy] = useState<'' | 'lookup' | 'validate' | 'save'>('')
  const [error, setError] = useState('')

  const isBr = market === 'BR'
  const ready = isBr ? brHeadquartersReady(settings.br.center) : usHeadquartersReady(settings.us.ship_from)
  const name = isBr ? settings.br.center.name : settings.us.ship_from.name
  const lines = isBr ? brLines(settings.br.center) : usLines(settings.us.ship_from)
  const errors = validation?.errors || {}
  const validForDraft = Boolean(validation?.valid) && validatedKey === addressKey(market, draft)

  const set = (key: string, value: string) => setDraft((current) => ({ ...current, [key]: value }))

  const startEdit = () => {
    setDraft(draftFrom(market, settings))
    setValidation(null)
    setValidatedKey('')
    setError('')
    setEditing(true)
  }

  // Fills the street and city from the postal code, so the admin only types the number.
  const lookupZip = async () => {
    const digits = (draft.zipcode || '').replace(/\D/g, '')
    if (!token || (isBr ? digits.length !== 8 : digits.length < 5)) return
    setBusy('lookup')
    try {
      const response = await apiRequest<{ data: { status: string; street?: string; neighborhood?: string; city?: string; state?: string } }>(
        '/onboarding/zipcode/lookup',
        { token, method: 'POST', body: { zipcode: draft.zipcode, country: market } },
      )
      const found = response.data
      if (found.status === 'found') {
        setDraft((current) => ({
          ...current,
          street: isBr ? (found.street || current.street) : current.street,
          neighborhood: isBr ? (found.neighborhood || current.neighborhood) : current.neighborhood,
          city: found.city || current.city,
          state: found.state || current.state,
        }))
      }
    } catch {
      // The validation step reports a bad postal code; the autofill is only a shortcut.
    } finally {
      setBusy('')
    }
  }

  const validate = async () => {
    if (!token) return
    setBusy('validate')
    setError('')
    try {
      const response = await apiRequest<{ data: HeadquartersValidation }>('/admin/shipping/headquarters/validate', {
        token,
        method: 'POST',
        body: { country: market, address: draft },
      })
      setValidation(response.data)
      if (response.data.valid) {
        const normalized = { ...draft, ...response.data.address }
        setDraft(normalized)
        setValidatedKey(addressKey(market, normalized))
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao validar o endereço')
    } finally {
      setBusy('')
    }
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !validForDraft) return
    setBusy('save')
    setError('')
    try {
      const body = isBr ? { br: { center: draft } } : { us: { ship_from: { ...draft, country: 'US' } } }
      const response = await apiRequest<{ data: { settings: Partial<ShippingSettings> } }>('/admin/shipping/settings', {
        token,
        method: 'PUT',
        body,
      })
      setEditing(false)
      onSaved(response.data.settings, isBr ? 'Sede do Brasil salva.' : 'Sede dos Estados Unidos salva.')
    } catch (requestError) {
      if (requestError instanceof ApiRequestError && requestError.details?.errors) {
        setValidation({
          valid: false,
          country: market,
          address: draft,
          errors: requestError.details.errors as Record<string, string>,
          warnings: (requestError.details.warnings as string[]) || [],
        })
      }
      setError(requestError instanceof Error ? requestError.message : 'Falha ao salvar a sede')
    } finally {
      setBusy('')
    }
  }

  const applyCandidate = (candidate: Record<string, string>) => {
    setDraft((current) => ({ ...current, ...candidate }))
    setValidation(null)
  }

  return (
    <article className="ship-hq-card" aria-label={isBr ? 'Sede Brasil' : 'Sede Estados Unidos'}>
      <header className="ship-hq-head">
        <div className="ship-hq-title">
          <span className="ship-market-tag">{market}</span>
          <div>
            <h4>{isBr ? 'Sede Brasil' : 'Sede Estados Unidos'}</h4>
            <p className="muted">{isBr ? 'Ponto de partida das entregas locais.' : 'Origem dos envios UPS (ship from).'}</p>
          </div>
        </div>
        <span className={ready ? 'badge-success' : 'badge-warning'}>{ready ? 'Endereço validado' : 'Endereço pendente'}</span>
      </header>

      {!editing ? (
        <div className="ship-hq-body">
          <address className="ship-address">
            <strong>{name || 'Sem nome'}</strong>
            {lines.length ? lines.map((line) => <span key={line}>{line}</span>) : <span className="muted">Nenhum endereço cadastrado.</span>}
          </address>
          {isBr && ready ? (
            <p className="ship-hint">
              Coordenadas encontradas automaticamente: {settings.br.center.lat.toFixed(5)}, {settings.br.center.lng.toFixed(5)}
            </p>
          ) : null}
          {canWrite ? (
            <button type="button" className="ghost-button" onClick={startEdit}>
              {ready ? 'Alterar endereço' : 'Cadastrar endereço'}
            </button>
          ) : null}
        </div>
      ) : (
        <form className="ship-hq-form" onSubmit={save} noValidate>
          <div className="ship-fields">
            <Field label={isBr ? 'Nome da sede' : 'Company / location name'} wide>
              <input value={draft.name || ''} onChange={(event) => set('name', event.target.value)} placeholder={isBr ? 'Cozinha Curitiba' : 'Eden Bowls Kitchen'} />
            </Field>
            {isBr ? (
              <>
                <Field label="CEP" error={errors.zipcode} hint="Rua, bairro e cidade são preenchidos pelo CEP.">
                  <input
                    value={draft.zipcode || ''}
                    onChange={(event) => set('zipcode', event.target.value)}
                    onBlur={() => void lookupZip()}
                    placeholder="00000-000"
                    inputMode="numeric"
                    autoComplete="postal-code"
                  />
                </Field>
                <Field label="Rua / logradouro" error={errors.street} wide>
                  <input value={draft.street || ''} onChange={(event) => set('street', event.target.value)} autoComplete="address-line1" />
                </Field>
                <Field label="Número" error={errors.number} hint="Use S/N se não houver.">
                  <input value={draft.number || ''} onChange={(event) => set('number', event.target.value)} />
                </Field>
                <Field label="Complemento (opcional)">
                  <input value={draft.complement || ''} onChange={(event) => set('complement', event.target.value)} placeholder="Galpão 2" />
                </Field>
                <Field label="Bairro" error={errors.neighborhood}>
                  <input value={draft.neighborhood || ''} onChange={(event) => set('neighborhood', event.target.value)} />
                </Field>
                <Field label="Cidade" error={errors.city}>
                  <input value={draft.city || ''} onChange={(event) => set('city', event.target.value)} autoComplete="address-level2" />
                </Field>
                <Field label="UF" error={errors.state}>
                  <select value={draft.state || ''} onChange={(event) => set('state', event.target.value)}>
                    <option value="">Selecione</option>
                    {BR_STATES.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </Field>
              </>
            ) : (
              <>
                <Field label="Address line 1" error={errors.street} hint="Street number and name, e.g. 350 5th Ave" wide>
                  <input value={draft.street || ''} onChange={(event) => set('street', event.target.value)} autoComplete="address-line1" />
                </Field>
                <Field label="Address line 2 (optional)" hint="Apt, suite, unit, building, floor" wide>
                  <input value={draft.street2 || ''} onChange={(event) => set('street2', event.target.value)} autoComplete="address-line2" />
                </Field>
                <Field label="City" error={errors.city}>
                  <input value={draft.city || ''} onChange={(event) => set('city', event.target.value)} autoComplete="address-level2" />
                </Field>
                <Field label="State" error={errors.state}>
                  <select value={draft.state || ''} onChange={(event) => set('state', event.target.value)}>
                    <option value="">Select</option>
                    {US_STATES.map(([code, label]) => <option key={code} value={code}>{label} ({code})</option>)}
                  </select>
                </Field>
                <Field label="ZIP code" error={errors.zipcode} hint="5 digits or ZIP+4">
                  <input
                    value={draft.zipcode || ''}
                    onChange={(event) => set('zipcode', event.target.value)}
                    onBlur={() => void lookupZip()}
                    placeholder="10118"
                    inputMode="numeric"
                    autoComplete="postal-code"
                  />
                </Field>
              </>
            )}
          </div>

          {error ? <div className="alert">{error}</div> : null}
          {validation ? (
            <div className={validation.valid ? 'ship-validation ship-validation-ok' : 'ship-validation ship-validation-bad'} role="status">
              <strong>{validation.valid ? 'Endereço válido' : 'Endereço com problemas'}</strong>
              {validation.valid && validation.location ? (
                <span>
                  Localização {validation.location.precision === 'address' ? 'exata' : 'pelo CEP'}: {validation.location.lat.toFixed(5)}, {validation.location.lng.toFixed(5)}
                </span>
              ) : null}
              {validation.valid && validation.ups ? (
                <span>
                  UPS: {({ valid: 'endereço confirmado', ambiguous: 'mais de um endereço parecido', no_candidates: 'não reconheceu o endereço', skipped: validation.ups.reason === 'sandbox_state_unsupported' ? 'validação pulada (o sandbox só valida NY e CA)' : 'validação pulada (sem credenciais)', error: 'não respondeu' } as Record<string, string>)[validation.ups.status] || validation.ups.status}
                </span>
              ) : null}
              {validation.warnings.map((warning) => <span key={warning} className="ship-warning-line">{warning}</span>)}
              {validation.ups?.status === 'ambiguous' && validation.ups.candidates.length ? (
                <div className="ship-candidates">
                  {validation.ups.candidates.slice(0, 3).map((candidate) => (
                    <button key={JSON.stringify(candidate)} type="button" className="ghost-button" onClick={() => applyCandidate(candidate)}>
                      Usar: {[candidate.street, candidate.city, candidate.state, candidate.zipcode].filter(Boolean).join(', ')}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="ship-actions">
            <button type="button" className="ghost-button" onClick={() => setEditing(false)}>Cancelar</button>
            <button type="button" className="ghost-button" onClick={() => void validate()} disabled={busy !== ''}>
              {busy === 'validate' ? 'Validando…' : 'Validar endereço'}
            </button>
            <button type="submit" className="primary-button" disabled={!validForDraft || busy !== ''}>
              {busy === 'save' ? 'Salvando…' : 'Salvar sede'}
            </button>
          </div>
        </form>
      )}
    </article>
  )
}
