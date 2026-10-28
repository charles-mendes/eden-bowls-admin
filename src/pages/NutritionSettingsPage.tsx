import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Dialog } from '../components/Dialog'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import { formatDate } from '../lib/format'
import { MARKET_LABELS, sessionMarkets, type MarketCode } from '../lib/markets'
import {
  BREED_GROUPS,
  BREED_GROUP_LABELS,
  FACTOR_RANGE,
  FACTOR_SECTIONS,
  MONTHS_RANGE,
  NEM_RANGE,
  SIZE_CLASSES,
  SIZE_CLASS_LABELS,
  cloneParameters,
  factorLabel,
  invalidFields,
  nutritionErrorMessage,
  transitionLabel,
  type BreedGroup,
  type BreedInput,
  type LifeStageBreed,
  type LifeStageOverview,
  type LifeStagePreview,
  type LimitsInput,
  type NutritionParameters,
  type ParametersOverview,
  type SizeClass,
} from '../lib/nutritionSettings'

type Tab = 'fases' | 'racas' | 'fatores'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'fases', label: 'Fases da vida' },
  { id: 'racas', label: 'Raças' },
  { id: 'fatores', label: 'Fatores' },
]

type LimitsForm = Record<SizeClass, { adult: string; senior: string }>

type PendingSave = { title: string; preview: LifeStagePreview; save: () => Promise<void> }

function limitsFormOf(overview: LifeStageOverview | null): LimitsForm {
  const form = Object.fromEntries(SIZE_CLASSES.map((sizeClass) => [sizeClass, { adult: '', senior: '' }])) as LimitsForm
  for (const row of overview?.sizeClasses ?? []) {
    if (row.sizeClass in form) form[row.sizeClass] = { adult: String(row.adultFromMonths), senior: String(row.seniorFromMonths) }
  }
  return form
}

function monthsLabel(value: string) {
  const months = Number(value)
  if (!Number.isFinite(months) || months <= 0) return ''
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (years === 0) return `${rest} ${rest === 1 ? 'mês' : 'meses'}`
  return rest ? `${years} a ${rest} m` : `${years} ${years === 1 ? 'ano' : 'anos'}`
}

// Life-stage limits, giant breeds and energy factors of the recommendation (nutrition-settings).
export function NutritionSettingsPage() {
  const { token, user, hasPermission } = useAuth()
  const canWrite = hasPermission('nutrition.settings.write')
  const assigned = sessionMarkets(user)
  // Staff without an assigned market (the veterinarian) may use both; the API scopes the rest.
  const markets: MarketCode[] = assigned.length ? assigned : ['BR', 'US']
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedMarket = String(searchParams.get('mercado') || '').toUpperCase() as MarketCode
  const market: MarketCode = markets.includes(requestedMarket) ? requestedMarket : markets[0]
  const requestedTab = searchParams.get('aba')
  const tab: Tab = TABS.some((option) => option.id === requestedTab) ? requestedTab as Tab : 'fases'

  const [overview, setOverview] = useState<LifeStageOverview | null>(null)
  const [limits, setLimits] = useState<LimitsForm>(limitsFormOf(null))
  const [invalid, setInvalid] = useState<string[]>([])
  const [newBreed, setNewBreed] = useState<{ name_pt: string; name_en: string; size_class: SizeClass }>({ name_pt: '', name_en: '', size_class: 'giant' })
  const [parameters, setParameters] = useState<ParametersOverview | null>(null)
  const [draft, setDraft] = useState<NutritionParameters | null>(null)
  const [pending, setPending] = useState<PendingSave | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadLifeStage = async () => {
    if (!token) return
    try {
      const next = await apiRequest<LifeStageOverview>(`/admin/life-stage${buildQueryString({ market })}`, { token })
      setOverview(next)
      setLimits(limitsFormOf(next))
    } catch (requestError) {
      setError(nutritionErrorMessage(requestError, 'Falha ao carregar as fases da vida'))
    }
  }

  const loadParameters = async () => {
    if (!token) return
    try {
      const next = await apiRequest<ParametersOverview>('/admin/nutrition/parameters', { token })
      setParameters(next)
      setDraft(cloneParameters(next.draft?.parameters ?? next.published.parameters))
    } catch (requestError) {
      setError(nutritionErrorMessage(requestError, 'Falha ao carregar os fatores'))
    }
  }

  useEffect(() => {
    setOverview(null)
    setInvalid([])
    void loadLifeStage()
  }, [token, market])

  useEffect(() => {
    void loadParameters()
  }, [token])

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
    document.getElementById(`nutrition-tab-${next.id}`)?.focus()
  }

  const fail = (requestError: unknown, fallback: string) => {
    setInvalid(invalidFields(requestError))
    setError(nutritionErrorMessage(requestError, fallback))
  }

  // Asks the API how many pets change stage; with none it saves at once, otherwise it waits for "Confirmar".
  const saveAfterPreview = async (title: string, body: { limits?: LimitsInput; breed?: BreedInput }, save: () => Promise<void>) => {
    if (!token) return
    setBusy(true)
    setMessage('')
    setError('')
    setInvalid([])
    try {
      const preview = await apiRequest<LifeStagePreview>('/admin/life-stage/preview', { token, method: 'POST', body: { market, ...body } })
      if (preview.pets_changing === 0) {
        await save()
      } else {
        setPending({ title, preview, save })
      }
    } catch (requestError) {
      fail(requestError, 'Falha na prévia')
    } finally {
      setBusy(false)
    }
  }

  const confirmPending = async () => {
    if (!pending) return
    setBusy(true)
    try {
      await pending.save()
      setPending(null)
    } catch (requestError) {
      setPending(null)
      fail(requestError, 'Falha ao salvar')
    } finally {
      setBusy(false)
    }
  }

  const changedLimits = (): LimitsInput => {
    const stored = limitsFormOf(overview)
    const changed: LimitsInput = {}
    for (const sizeClass of SIZE_CLASSES) {
      const row = limits[sizeClass]
      if (row.adult !== stored[sizeClass].adult || row.senior !== stored[sizeClass].senior) {
        changed[sizeClass] = { adult_from_months: Number(row.adult), senior_from_months: Number(row.senior) }
      }
    }
    return changed
  }

  const submitLimits = async (event: FormEvent) => {
    event.preventDefault()
    const changed = changedLimits()
    if (Object.keys(changed).length === 0) {
      setMessage('Nada mudou nos limites.')
      return
    }
    await saveAfterPreview('Salvar limites', { limits: changed }, async () => {
      const next = await apiRequest<LifeStageOverview>('/admin/life-stage/limits', { token, method: 'PUT', body: { market, limits: changed } })
      setOverview(next)
      setLimits(limitsFormOf(next))
      setMessage(`Limites de ${MARKET_LABELS[market]} salvos.`)
    })
  }

  const saveBreed = async (breed: LifeStageBreed, changes: BreedInput, done: string) => {
    await saveAfterPreview(done, { breed: { id: breed.id, ...changes } }, async () => {
      await apiRequest<LifeStageBreed>(`/admin/life-stage/breeds/${breed.id}`, { token, method: 'PATCH', body: { market, ...changes } })
      await loadLifeStage()
      setMessage(`${breed.namePt}: ${done.toLowerCase()}.`)
    })
  }

  const submitNewBreed = async (event: FormEvent) => {
    event.preventDefault()
    const breed = { ...newBreed, name_pt: newBreed.name_pt.trim(), name_en: newBreed.name_en.trim() }
    await saveAfterPreview('Incluir raça', { breed }, async () => {
      await apiRequest<LifeStageBreed>('/admin/life-stage/breeds', { token, method: 'POST', body: { market, ...breed } })
      await loadLifeStage()
      setNewBreed({ name_pt: '', name_en: '', size_class: 'giant' })
      setMessage(`${breed.name_pt} incluída.`)
    })
  }

  const runParameters = async (work: () => Promise<void>, fallback: string) => {
    setBusy(true)
    setMessage('')
    setError('')
    setInvalid([])
    try {
      await work()
    } catch (requestError) {
      fail(requestError, fallback)
    } finally {
      setBusy(false)
    }
  }

  const saveDraft = () => runParameters(async () => {
    if (!draft) return
    // Blank lines of the breed lists are not breeds.
    const groups = Object.fromEntries(BREED_GROUPS.map((group) => [group, draft.breed_groups[group].map((breed) => breed.trim()).filter(Boolean)]))
    await apiRequest('/admin/nutrition/parameters/draft', { token, method: 'PUT', body: { parameters: { ...draft, breed_groups: groups } } })
    await loadParameters()
    setMessage('Rascunho salvo. Use o simulador com o rascunho antes de publicar.')
  }, 'Falha ao salvar o rascunho')

  const discardDraft = () => runParameters(async () => {
    await apiRequest('/admin/nutrition/parameters/draft', { token, method: 'DELETE' })
    await loadParameters()
    setMessage('Rascunho descartado.')
  }, 'Falha ao descartar o rascunho')

  const publish = () => runParameters(async () => {
    setPublishing(false)
    await apiRequest('/admin/nutrition/parameters/publish', { token, method: 'POST' })
    await loadParameters()
    setMessage('Conjunto publicado. As próximas recomendações usam estes valores.')
  }, 'Falha ao publicar')

  const copyToDraft = (id: number) => runParameters(async () => {
    await apiRequest(`/admin/nutrition/parameters/${id}/copy-to-draft`, { token, method: 'POST' })
    await loadParameters()
    setMessage(`Conjunto #${id} copiado para o rascunho.`)
  }, 'Falha ao copiar o conjunto')

  const updateFactor = (section: 'combination' | 'state' | 'base' | 'nem', key: string, value: string) => {
    setDraft((current) => (current ? { ...current, [section]: { ...current[section], [key]: value === '' ? Number.NaN : Number(value) } } : current))
  }

  const updateGroup = (group: BreedGroup, text: string) => {
    setDraft((current) => (current ? { ...current, breed_groups: { ...current.breed_groups, [group]: text.split('\n') } } : current))
  }

  const isInvalid = (field: string) => invalid.some((item) => item === field || item.startsWith(`${field}:`))
  const shown = canWrite ? draft : parameters?.published.parameters ?? null
  const draftReadOnly = !canWrite || busy

  return (
    <PageFrame
      title="Parâmetros nutricionais"
      description="Fases da vida, raças com porte próprio e fatores de energia usados na recomendação."
      actions={tab !== 'fatores' && markets.length > 1 ? (
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

      <div className="page-tabs" role="tablist" aria-label="Parâmetros nutricionais" onKeyDown={moveTabFocus}>
        {TABS.map((option) => (
          <button
            key={option.id}
            id={`nutrition-tab-${option.id}`}
            type="button"
            role="tab"
            aria-selected={tab === option.id}
            aria-controls={`nutrition-panel-${option.id}`}
            tabIndex={tab === option.id ? 0 : -1}
            className={tab === option.id ? 'page-tab active' : 'page-tab'}
            onClick={() => setParam({ aba: option.id })}
          >
            {option.label}
            {option.id === 'fatores' && parameters?.draft ? <span className="page-tab-flag">rascunho</span> : null}
          </button>
        ))}
      </div>

      {tab === 'fases' ? (
        <form id="nutrition-panel-fases" role="tabpanel" aria-labelledby="nutrition-tab-fases" onSubmit={submitLimits}>
          <Section
            title={`Limites de ${MARKET_LABELS[market]}`}
            description="Idade, em meses, em que o cão passa a adulto e a sênior, por porte. Antes de salvar, a prévia mostra quantos pets com assinatura ativa mudariam de fase."
          >
            {!overview ? <p className="muted" aria-busy="true">Carregando…</p> : (
              <div className="table-shell">
                <table>
                  <thead>
                    <tr><th>Porte</th><th>Adulto a partir de (meses)</th><th>Sênior a partir de (meses)</th></tr>
                  </thead>
                  <tbody>
                    {SIZE_CLASSES.map((sizeClass) => (
                      <tr key={sizeClass}>
                        <th scope="row">{SIZE_CLASS_LABELS[sizeClass]}</th>
                        {(['adult', 'senior'] as const).map((stage) => {
                          const field = `${sizeClass}.${stage === 'adult' ? 'adult_from_months' : 'senior_from_months'}`
                          return (
                            <td key={stage}>
                              <div className="ship-field">
                                <input
                                  aria-label={`${SIZE_CLASS_LABELS[sizeClass]}: ${stage === 'adult' ? 'adulto' : 'sênior'} a partir de`}
                                  aria-describedby={`limit-hint-${field}`}
                                  type="number"
                                  min={MONTHS_RANGE.min}
                                  max={MONTHS_RANGE.max}
                                  step="1"
                                  value={limits[sizeClass][stage]}
                                  disabled={!canWrite || busy}
                                  aria-invalid={isInvalid(field) || undefined}
                                  onChange={(event) => setLimits((current) => ({ ...current, [sizeClass]: { ...current[sizeClass], [stage]: event.target.value } }))}
                                />
                                <small id={`limit-hint-${field}`} className="ship-hint">{monthsLabel(limits[sizeClass][stage])}</small>
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {canWrite && overview ? (
              <div className="table-actions">
                <button className="primary-button" type="submit" disabled={busy}>Salvar limites</button>
              </div>
            ) : null}
          </Section>
        </form>
      ) : null}

      {tab === 'racas' ? (
        <div id="nutrition-panel-racas" role="tabpanel" aria-labelledby="nutrition-tab-racas">
          <Section
            title={`Raças com porte próprio em ${MARKET_LABELS[market]}`}
            description="Uma raça listada aqui usa o porte da tabela, qualquer que seja o porte informado pelo cliente. Os nomes são comparados sem acento e sem maiúsculas."
          >
            {!overview ? <p className="muted" aria-busy="true">Carregando…</p> : (
              <div className="table-shell table-scroll">
                <table>
                  <thead>
                    <tr><th>Nome em português</th><th>Nome em inglês</th><th>Porte</th><th>Situação</th>{canWrite ? <th>Ações</th> : null}</tr>
                  </thead>
                  <tbody>
                    {overview.breeds.map((breed) => (
                      <tr key={breed.id}>
                        <td>{breed.namePt}</td>
                        <td>{breed.nameEn}</td>
                        <td>
                          {canWrite ? (
                            <select
                              aria-label={`Porte de ${breed.namePt}`}
                              value={breed.sizeClass}
                              disabled={busy}
                              onChange={(event) => void saveBreed(breed, { size_class: event.target.value as SizeClass }, 'Porte alterado')}
                            >
                              {SIZE_CLASSES.map((sizeClass) => <option key={sizeClass} value={sizeClass}>{SIZE_CLASS_LABELS[sizeClass]}</option>)}
                            </select>
                          ) : SIZE_CLASS_LABELS[breed.sizeClass]}
                        </td>
                        <td><span className={breed.active ? 'badge-success' : 'badge-warning'}>{breed.active ? 'Ativa' : 'Desativada'}</span></td>
                        {canWrite ? (
                          <td>
                            <button className="ghost-button" type="button" disabled={busy} onClick={() => void saveBreed(breed, { active: !breed.active }, breed.active ? 'Desativada' : 'Reativada')}>
                              {breed.active ? 'Desativar' : 'Reativar'}
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
          {canWrite ? (
            <form onSubmit={submitNewBreed}>
              <Section title="Incluir raça" description="Os dois nomes são obrigatórios: o cliente pode escrever a raça em qualquer um dos idiomas.">
                <div className="ship-fields">
                  <label className="ship-field">
                    <span>Nome em português</span>
                    <input value={newBreed.name_pt} maxLength={120} required disabled={busy} aria-invalid={isInvalid('name_pt') || undefined} onChange={(event) => setNewBreed((current) => ({ ...current, name_pt: event.target.value }))} />
                  </label>
                  <label className="ship-field">
                    <span>Nome em inglês</span>
                    <input value={newBreed.name_en} maxLength={120} required disabled={busy} aria-invalid={isInvalid('name_en') || undefined} onChange={(event) => setNewBreed((current) => ({ ...current, name_en: event.target.value }))} />
                  </label>
                  <label className="ship-field">
                    <span>Porte</span>
                    <select value={newBreed.size_class} disabled={busy} onChange={(event) => setNewBreed((current) => ({ ...current, size_class: event.target.value as SizeClass }))}>
                      {SIZE_CLASSES.map((sizeClass) => <option key={sizeClass} value={sizeClass}>{SIZE_CLASS_LABELS[sizeClass]}</option>)}
                    </select>
                  </label>
                </div>
                <div className="table-actions">
                  <button className="primary-button" type="submit" disabled={busy}>Incluir raça</button>
                </div>
              </Section>
            </form>
          ) : null}
        </div>
      ) : null}

      {tab === 'fatores' ? (
        <div id="nutrition-panel-fatores" role="tabpanel" aria-labelledby="nutrition-tab-fatores">
          {!parameters || !shown ? <p className="muted" aria-busy="true">Carregando…</p> : (
            <>
              <Section
                title={canWrite ? (parameters.draft ? `Rascunho #${parameters.draft.id}` : 'Novo rascunho') : 'Conjunto publicado'}
                description={`Publicado${parameters.published.id ? ` (#${parameters.published.id})` : ''} em ${parameters.published.publishedAt ? formatDate(parameters.published.publishedAt) : '—'}. Vale para os dois mercados.${canWrite && !parameters.draft ? ' O rascunho começa com os valores publicados.' : ''}`}
                actions={canWrite ? (
                  <div className="table-actions">
                    {parameters.draft ? <button className="ghost-button" type="button" disabled={busy} onClick={() => void discardDraft()}>Descartar rascunho</button> : null}
                    <button className="ghost-button" type="button" disabled={busy} onClick={() => void saveDraft()}>Salvar rascunho</button>
                    {parameters.draft ? <button className="primary-button" type="button" disabled={busy} onClick={() => setPublishing(true)}>Publicar</button> : null}
                  </div>
                ) : undefined}
              >
                {canWrite && parameters.draft ? <p className="muted">Teste o rascunho no Simulador nutricional, com "Simular com o rascunho", antes de publicar.</p> : null}
              </Section>
              {FACTOR_SECTIONS.map((section) => {
                const range = section.key === 'nem' ? NEM_RANGE : FACTOR_RANGE
                return (
                  <Section key={section.key} title={section.title} description={section.description}>
                    <div className="ship-fields ship-fields-4">
                      {Object.entries(shown[section.key]).map(([key, value]) => (
                        <label key={key} className="ship-field">
                          <span>{factorLabel(section.key, key)}</span>
                          <input
                            type="number"
                            min={range.min}
                            max={range.max}
                            step="0.01"
                            value={Number.isNaN(value) ? '' : value}
                            disabled={draftReadOnly}
                            aria-invalid={isInvalid(`${section.key}.${key}`) || undefined}
                            onChange={(event) => updateFactor(section.key, key, event.target.value)}
                          />
                        </label>
                      ))}
                    </div>
                  </Section>
                )
              })}
              <Section title="Grupos de raça" description="Uma raça por linha, sem acento. Uma raça só pode estar num grupo.">
                <div className="ship-fields">
                  {BREED_GROUPS.map((group) => (
                    <label key={group} className="ship-field">
                      <span>{BREED_GROUP_LABELS[group]}</span>
                      <textarea
                        rows={6}
                        value={shown.breed_groups[group].join('\n')}
                        disabled={draftReadOnly}
                        aria-invalid={isInvalid(`breed_groups.${group}`) || undefined}
                        onChange={(event) => updateGroup(group, event.target.value)}
                      />
                    </label>
                  ))}
                </div>
              </Section>
              <Section title="Histórico" description="Conjuntos publicados antes. Um conjunto antigo volta como rascunho, para ser publicado de novo.">
                <div className="table-shell">
                  <table>
                    <thead>
                      <tr><th>Conjunto</th><th>Situação</th><th>Publicado em</th>{canWrite ? <th>Ações</th> : null}</tr>
                    </thead>
                    <tbody>
                      {parameters.history.map((set) => (
                        <tr key={set.id}>
                          <td>#{set.id}</td>
                          <td><span className={set.status === 'published' ? 'badge-success' : 'badge-info'}>{set.status === 'published' ? 'Publicado' : 'Anterior'}</span></td>
                          <td>{set.publishedAt ? formatDate(set.publishedAt) : '—'}</td>
                          {canWrite ? (
                            <td>
                              {set.status === 'retired' ? (
                                <button className="ghost-button" type="button" disabled={busy} onClick={() => void copyToDraft(set.id)}>Copiar para rascunho</button>
                              ) : null}
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            </>
          )}
        </div>
      ) : null}

      <Dialog
        title={pending?.title ?? ''}
        description="Esta mudança altera a fase de pets com assinatura ativa. O e-mail de mudança de fase sai pelo job, com lote e limite diário."
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        footer={(
          <>
            <button className="ghost-button" type="button" onClick={() => setPending(null)}>Cancelar</button>
            <button className="primary-button" type="button" disabled={busy} onClick={() => void confirmPending()}>Confirmar</button>
          </>
        )}
      >
        {pending ? (
          <>
            <p>{`${pending.preview.pets_changing} de ${pending.preview.pets_evaluated} pets mudariam de fase em ${MARKET_LABELS[market]}:`}</p>
            <ul>
              {pending.preview.transitions.map((item) => (
                <li key={`${item.from}-${item.to}`}>{`${transitionLabel(item.from, item.to)}: ${item.count}`}</li>
              ))}
            </ul>
          </>
        ) : null}
      </Dialog>

      <Dialog
        title="Publicar conjunto"
        description="As próximas recomendações dos dois mercados passam a usar o rascunho. O conjunto atual vai para o histórico."
        open={publishing}
        onClose={() => setPublishing(false)}
        footer={(
          <>
            <button className="ghost-button" type="button" onClick={() => setPublishing(false)}>Cancelar</button>
            <button className="primary-button" type="button" disabled={busy} onClick={() => void publish()}>Confirmar publicação</button>
          </>
        )}
      >
        <p>{`Rascunho #${parameters?.draft?.id ?? ''}.`}</p>
      </Dialog>
    </PageFrame>
  )
}
