import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Dialog } from '../components/Dialog'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import {
  BATCH_RANGE,
  COMPANY_FIELDS,
  DAILY_CAP_RANGE,
  LEGAL_KINDS,
  companyFieldLabel,
  settingsErrorMessage,
  settingsInvalidFields,
  todayVersion,
  type AutomatedEmailSettings,
  type CompanyField,
  type CompanyProfile,
  type LegalKind,
  type LegalOverview,
  type LegalVersion,
} from '../lib/adminSettings'
import { formatDate } from '../lib/format'
import { MARKET_LABELS, sessionMarkets, type MarketCode } from '../lib/markets'

type Tab = 'empresa' | 'legal' | 'emails'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'empresa', label: 'Empresa' },
  { id: 'legal', label: 'Documentos legais' },
  { id: 'emails', label: 'E-mails automáticos' },
]

type CompanyForm = Record<CompanyField, string>
type EmailsForm = { enabled: boolean; batch: string; cap: string }

function companyFormOf(profile: CompanyProfile | null): CompanyForm {
  return Object.fromEntries(COMPANY_FIELDS.map((field) => [field.key, profile?.[field.key] ?? ''])) as CompanyForm
}

function emailsFormOf(settings: AutomatedEmailSettings | null): EmailsForm {
  return {
    enabled: Boolean(settings?.life_stage_change_enabled),
    batch: settings ? String(settings.announcement_batch_size) : '',
    cap: settings ? String(settings.announcement_daily_cap) : '',
  }
}

const kindLabel = (kind: LegalKind) => LEGAL_KINDS.find((item) => item.id === kind)?.label ?? kind

// Company profile, legal documents and automated emails per market (admin-settings).
export function SettingsPage() {
  const { token, user, hasPermission } = useAuth()
  const canWriteCompany = hasPermission('settings.company.write')
  const canWriteLegal = hasPermission('legal.write')
  const canWriteEmails = hasPermission('settings.email.write')
  const assigned = sessionMarkets(user)
  const markets: MarketCode[] = assigned.length ? assigned : ['BR', 'US']
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedMarket = String(searchParams.get('mercado') || '').toUpperCase() as MarketCode
  const market: MarketCode = markets.includes(requestedMarket) ? requestedMarket : markets[0]
  const requestedTab = searchParams.get('aba')
  const tab: Tab = TABS.some((option) => option.id === requestedTab) ? requestedTab as Tab : 'empresa'
  const kind: LegalKind = searchParams.get('documento') === 'terms' ? 'terms' : 'privacy'

  const [company, setCompany] = useState<CompanyProfile | null>(null)
  const [companyForm, setCompanyForm] = useState<CompanyForm>(companyFormOf(null))
  const [legal, setLegal] = useState<LegalOverview | null>(null)
  const [version, setVersion] = useState(todayVersion())
  const [body, setBody] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [reading, setReading] = useState<LegalVersion | null>(null)
  const [emails, setEmails] = useState<AutomatedEmailSettings | null>(null)
  const [emailsForm, setEmailsForm] = useState<EmailsForm>(emailsFormOf(null))
  const [invalid, setInvalid] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    setInvalid([])
    if (tab === 'empresa') {
      setCompany(null)
      apiRequest<CompanyProfile>(`/admin/settings/company${buildQueryString({ market })}`, { token })
        .then((profile) => { setCompany(profile); setCompanyForm(companyFormOf(profile)) })
        .catch((requestError) => setError(settingsErrorMessage(requestError, 'Falha ao carregar a empresa', market)))
    } else if (tab === 'legal') {
      setLegal(null)
      apiRequest<LegalOverview>(`/admin/legal/${kind}?market=${market}`, { token })
        .then((overview) => { setLegal(overview); setBody(overview.current?.body_markdown ?? ''); setVersion(todayVersion()) })
        .catch((requestError) => setError(settingsErrorMessage(requestError, 'Falha ao carregar o documento', market)))
    } else {
      setEmails(null)
      apiRequest<AutomatedEmailSettings>(`/admin/settings/automated-emails${buildQueryString({ market })}`, { token })
        .then((settings) => { setEmails(settings); setEmailsForm(emailsFormOf(settings)) })
        .catch((requestError) => setError(settingsErrorMessage(requestError, 'Falha ao carregar os e-mails', market)))
    }
  }, [token, tab, market, kind])

  const setParam = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(patch)) next.set(key, value)
    setSearchParams(next, { replace: true })
    setMessage('')
    setError('')
  }

  const moveTabFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    const index = TABS.findIndex((option) => option.id === tab)
    const next = TABS[(index + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]
    setParam({ aba: next.id })
    document.getElementById(`settings-tab-${next.id}`)?.focus()
  }

  const run = async (work: () => Promise<void>, fallback: string) => {
    if (!token) return
    setBusy(true)
    setMessage('')
    setError('')
    setInvalid([])
    try {
      await work()
    } catch (requestError) {
      setInvalid(settingsInvalidFields(requestError))
      setError(settingsErrorMessage(requestError, fallback, market))
    } finally {
      setBusy(false)
    }
  }

  const submitCompany = (event: FormEvent) => {
    event.preventDefault()
    void run(async () => {
      // The fields go under `profile`: a top-level `country` would be read as the market.
      const profile = await apiRequest<CompanyProfile>('/admin/settings/company', { token, method: 'PUT', body: { market, profile: companyForm } })
      setCompany(profile)
      setCompanyForm(companyFormOf(profile))
      setMessage(`Dados da empresa de ${MARKET_LABELS[market]} salvos.`)
    }, 'Falha ao salvar a empresa')
  }

  const publishLegal = () => run(async () => {
    setPublishing(false)
    const overview = await apiRequest<LegalOverview>(`/admin/legal/${kind}`, { token, method: 'POST', body: { market, version: version.trim(), body_markdown: body } })
    setLegal(overview)
    setBody(overview.current?.body_markdown ?? body)
    setMessage(`${kindLabel(kind)} ${overview.current?.version ?? version} publicada em ${MARKET_LABELS[market]}.`)
  }, 'Falha ao publicar o documento')

  const readVersion = (id: string) => run(async () => {
    setReading(await apiRequest<LegalVersion>(`/admin/legal/${kind}/versions/${encodeURIComponent(id)}?market=${market}`, { token }))
  }, 'Falha ao abrir a versão')

  const submitEmails = (event: FormEvent) => {
    event.preventDefault()
    const batch = Number(emailsForm.batch)
    const cap = Number(emailsForm.cap)
    if (Number.isFinite(batch) && Number.isFinite(cap) && cap < batch) {
      setMessage('')
      setInvalid(['announcement_daily_cap'])
      setError('O limite diário não pode ser menor que o lote por execução.')
      return
    }
    void run(async () => {
      const settings = await apiRequest<AutomatedEmailSettings>('/admin/settings/automated-emails', {
        token,
        method: 'PUT',
        body: { market, life_stage_change_enabled: emailsForm.enabled, announcement_batch_size: batch, announcement_daily_cap: cap },
      })
      setEmails(settings)
      setEmailsForm(emailsFormOf(settings))
      setMessage('E-mails automáticos salvos. A mudança vale na próxima execução do job.')
    }, 'Falha ao salvar os e-mails')
  }

  const isInvalid = (field: string) => invalid.includes(field) || undefined

  return (
    <PageFrame
      title="Configurações"
      description="Dados da empresa, documentos legais e e-mails automáticos de cada mercado."
      actions={markets.length > 1 ? (
        <div className="segmented" role="group" aria-label="Mercado">
          {markets.map((option) => (
            <button key={option} type="button" aria-pressed={market === option} className={market === option ? 'active' : ''} onClick={() => setParam({ mercado: option.toLowerCase() })}>
              {MARKET_LABELS[option]}
            </button>
          ))}
        </div>
      ) : undefined}
    >
      {error ? <div className="alert" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}

      <div className="page-tabs" role="tablist" aria-label="Configurações" onKeyDown={moveTabFocus}>
        {TABS.map((option) => (
          <button
            key={option.id}
            id={`settings-tab-${option.id}`}
            type="button"
            role="tab"
            aria-selected={tab === option.id}
            aria-controls={`settings-panel-${option.id}`}
            tabIndex={tab === option.id ? 0 : -1}
            className={tab === option.id ? 'page-tab active' : 'page-tab'}
            onClick={() => setParam({ aba: option.id })}
          >
            {option.label}
          </button>
        ))}
      </div>

      {tab === 'empresa' ? (
        <form id="settings-panel-empresa" role="tabpanel" aria-labelledby="settings-tab-empresa" onSubmit={submitCompany}>
          <Section
            title={`Empresa em ${MARKET_LABELS[market]}`}
            description="Emissor das novas invoices e dados dos e-mails. Invoices já emitidas mantêm o emissor que imprimiram."
          >
            {!company ? <p className="muted" aria-busy="true">Carregando…</p> : (
              <div className="ship-fields">
                {COMPANY_FIELDS.map((field) => (
                  <label key={field.key} className="ship-field">
                    <span>{companyFieldLabel(field.key, market)}</span>
                    <input
                      type={field.type ?? 'text'}
                      value={companyForm[field.key]}
                      required={field.required || (field.key === 'tax_id' && market === 'BR')}
                      disabled={!canWriteCompany || busy}
                      aria-invalid={isInvalid(field.key)}
                      onChange={(event) => setCompanyForm((current) => ({ ...current, [field.key]: event.target.value }))}
                    />
                  </label>
                ))}
              </div>
            )}
            {company?.updated_at ? <p className="ship-hint">{`Atualizado em ${formatDate(company.updated_at)}`}</p> : null}
            {canWriteCompany && company ? (
              <div className="table-actions">
                <button className="primary-button" type="submit" disabled={busy}>Salvar empresa</button>
              </div>
            ) : null}
          </Section>
        </form>
      ) : null}

      {tab === 'legal' ? (
        <div id="settings-panel-legal" role="tabpanel" aria-labelledby="settings-tab-legal">
          <div className="segmented" role="group" aria-label="Documento">
            {LEGAL_KINDS.map((option) => (
              <button key={option.id} type="button" aria-pressed={kind === option.id} className={kind === option.id ? 'active' : ''} onClick={() => setParam({ documento: option.id })}>
                {option.label}
              </button>
            ))}
          </div>
          {!legal ? <p className="muted" aria-busy="true">Carregando…</p> : (
            <>
              <Section
                title={`${kindLabel(kind)} · ${MARKET_LABELS[market]}`}
                description={legal.current
                  ? `Versão atual ${legal.current.version}${legal.current.published_at ? `, publicada em ${formatDate(legal.current.published_at)}` : ''}. A loja mostra esta versão e o cadastro registra o aceite dela.`
                  : 'Nenhuma versão publicada neste mercado.'}
              >
                {canWriteLegal ? (
                  <form
                    className="ship-fields"
                    onSubmit={(event) => { event.preventDefault(); setPublishing(true) }}
                  >
                    <label className="ship-field">
                      <span>Versão (AAAA-MM-DD)</span>
                      <input value={version} required pattern="\d{4}-\d{2}-\d{2}" disabled={busy} aria-invalid={isInvalid('version')} onChange={(event) => setVersion(event.target.value)} />
                    </label>
                    <label className="ship-field">
                      <span>Texto (Markdown)</span>
                      <textarea rows={18} value={body} required disabled={busy} aria-invalid={isInvalid('body_markdown')} onChange={(event) => setBody(event.target.value)} />
                    </label>
                    <div className="table-actions">
                      <button className="primary-button" type="submit" disabled={busy || !body.trim()}>Publicar versão</button>
                    </div>
                  </form>
                ) : legal.current ? (
                  <pre className="legal-text">{legal.current.body_markdown}</pre>
                ) : null}
              </Section>
              <Section title="Versões anteriores" description="Uma versão publicada não muda. Para corrigir, publique outra.">
                {legal.versions.length === 0 ? <p className="muted">Nenhuma versão.</p> : (
                  <div className="table-shell">
                    <table>
                      <thead>
                        <tr><th>Versão</th><th>Publicada em</th><th>Ações</th></tr>
                      </thead>
                      <tbody>
                        {legal.versions.map((item) => (
                          <tr key={item.version}>
                            <td>{item.version}{item.version === legal.current?.version ? <span className="badge badge-success"> atual</span> : null}</td>
                            <td>{item.published_at ? formatDate(item.published_at) : '—'}</td>
                            <td>
                              <button className="ghost-button" type="button" disabled={busy} onClick={() => void readVersion(item.version)} aria-label={`Ler versão ${item.version}`}>Ler</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>
            </>
          )}
        </div>
      ) : null}

      {tab === 'emails' ? (
        <form id="settings-panel-emails" role="tabpanel" aria-labelledby="settings-tab-emails" onSubmit={submitEmails}>
          <Section
            title={`E-mails automáticos em ${MARKET_LABELS[market]}`}
            description="O e-mail de mudança de fase sai pelo job, em lotes, até o limite do dia. Uma mudança vale na próxima execução do job."
          >
            {!emails ? <p className="muted" aria-busy="true">Carregando…</p> : (
              <div className="ship-fields">
                <label className="ship-field">
                  <span>E-mail de mudança de fase</span>
                  <input
                    type="checkbox"
                    checked={emailsForm.enabled}
                    disabled={!canWriteEmails || busy}
                    onChange={(event) => setEmailsForm((current) => ({ ...current, enabled: event.target.checked }))}
                  />
                </label>
                <label className="ship-field">
                  <span>Lote por execução</span>
                  <input
                    type="number"
                    min={BATCH_RANGE.min}
                    max={BATCH_RANGE.max}
                    step="1"
                    required
                    value={emailsForm.batch}
                    disabled={!canWriteEmails || busy}
                    aria-invalid={isInvalid('announcement_batch_size')}
                    onChange={(event) => setEmailsForm((current) => ({ ...current, batch: event.target.value }))}
                  />
                </label>
                <label className="ship-field">
                  <span>Limite diário</span>
                  <input
                    type="number"
                    min={DAILY_CAP_RANGE.min}
                    max={DAILY_CAP_RANGE.max}
                    step="1"
                    required
                    value={emailsForm.cap}
                    disabled={!canWriteEmails || busy}
                    aria-invalid={isInvalid('announcement_daily_cap')}
                    onChange={(event) => setEmailsForm((current) => ({ ...current, cap: event.target.value }))}
                  />
                </label>
              </div>
            )}
            {canWriteEmails && emails ? (
              <div className="table-actions">
                <button className="primary-button" type="submit" disabled={busy}>Salvar e-mails</button>
              </div>
            ) : null}
          </Section>
        </form>
      ) : null}

      <Dialog
        title={`Publicar ${kindLabel(kind).toLowerCase()}`}
        description={`A versão ${version} passa a ser a atual em ${MARKET_LABELS[market]}. Os próximos cadastros registram o aceite dela. Uma versão publicada não pode ser editada.`}
        open={publishing}
        onClose={() => setPublishing(false)}
        footer={(
          <>
            <button className="ghost-button" type="button" onClick={() => setPublishing(false)}>Cancelar</button>
            <button className="primary-button" type="button" disabled={busy} onClick={() => void publishLegal()}>Confirmar publicação</button>
          </>
        )}
      >
        <p>{`${body.trim().split('\n').length} linhas de texto.`}</p>
      </Dialog>
      <Dialog
        title={reading ? `${kindLabel(kind)} ${reading.version}` : ''}
        description={reading?.published_at ? `Publicada em ${formatDate(reading.published_at)}.` : undefined}
        open={Boolean(reading)}
        onClose={() => setReading(null)}
        footer={<button className="ghost-button" type="button" onClick={() => setReading(null)}>Fechar</button>}
      >
        {reading ? <pre className="legal-text">{reading.body_markdown}</pre> : null}
      </Dialog>
    </PageFrame>
  )
}
