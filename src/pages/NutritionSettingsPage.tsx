import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Dialog } from '../components/Dialog'
import { InfoHint } from '../components/InfoHint'
import { NutritionEditLog } from '../components/NutritionEditLog'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import { formatDate } from '../lib/format'
import { MARKET_LABELS, sessionMarkets, type MarketCode } from '../lib/markets'
import {
  BREED_GROUPS,
  BREED_GROUP_LABELS,
  COMBINATION_ROWS,
  COMBINATION_SCORES,
  FACTOR_RANGE,
  FACTOR_SECTIONS,
  MONTHS_RANGE,
  NEM_RANGE,
  SIZE_CLASSES,
  SIZE_CLASS_LABELS,
  HELP,
  SPECIES_OPTIONS,
  cloneParameters,
  combinationRowLabel,
  factorLabel,
  invalidFields,
  nutritionErrorMessage,
  speciesOfField,
  speciesOfKey,
  transitionLabel,
  type BreedGroup,
  type FactorSection,
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
  { id: 'racas', label: 'Raças' },
  { id: 'fases', label: 'Fases da vida' },
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

// A label with its "i". `end` opens the tip leftwards, for the last columns.
function Hinted({ id, label, text, end = false }: { id: string; label: string; text: string; end?: boolean }) {
  return (
    <span className={end ? 'label-with-hint end' : 'label-with-hint'}>
      {label}
      <InfoHint id={id} topic={label.toLowerCase()} text={text} />
    </span>
  )
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
  // The operator creates and edits breeds only in the market assigned to them; the veterinarian and the admin in any.
  const userReady = Boolean(user)
  const canWriteBreeds = canWrite || (hasPermission('nutrition.breeds.write') && assigned.includes(market))
  const canWriteLimits = canWrite || (hasPermission('nutrition.limits.write') && assigned.includes(market))
  const speciesOption = SPECIES_OPTIONS.find((option) => option.id === searchParams.get('especie')) ?? SPECIES_OPTIONS[0]
  const species = speciesOption.species
  const requestedTab = searchParams.get('aba')
  const tab: Tab = TABS.some((option) => option.id === requestedTab) ? requestedTab as Tab : TABS[0].id

  const [overview, setOverview] = useState<LifeStageOverview | null>(null)
  const [limits, setLimits] = useState<LimitsForm>(limitsFormOf(null))
  const [invalid, setInvalid] = useState<string[]>([])
  const [newBreed, setNewBreed] = useState<{ name_pt: string; name_en: string; size_class: SizeClass }>({ name_pt: '', name_en: '', size_class: 'giant' })
  const [parameters, setParameters] = useState<ParametersOverview | null>(null)
  const [draft, setDraft] = useState<NutritionParameters | null>(null)
  const [pending, setPending] = useState<PendingSave | null>(null)
  const [creatingBreed, setCreatingBreed] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadLifeStage = async () => {
    // The market depends on the session's markets: wait for them so no request names a market outside the scope.
    if (!token || !userReady) return
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
  }, [token, userReady, market])

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
    const fields = invalidFields(requestError)
    setInvalid(fields)
    setError(nutritionErrorMessage(requestError, fallback))
    // A factor of the other species is invalid and none of this one: show the species with the marked fields.
    const owners = fields.map(speciesOfField)
    const other = SPECIES_OPTIONS.find((option) => option.species !== species)
    if (tab === 'fatores' && other && owners.length && owners.every((owner) => owner === other.species)) {
      const next = new URLSearchParams(searchParams)
      next.set('especie', other.id)
      setSearchParams(next, { replace: true })
    }
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
        setCreatingBreed(false)
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

  const openNewBreed = () => {
    setMessage('')
    setError('')
    setInvalid([])
    setCreatingBreed(true)
  }

  const closeNewBreed = () => {
    setCreatingBreed(false)
    setError('')
    setInvalid([])
  }

  const submitNewBreed = async (event: FormEvent) => {
    event.preventDefault()
    const breed = { ...newBreed, name_pt: newBreed.name_pt.trim(), name_en: newBreed.name_en.trim() }
    await saveAfterPreview('Incluir raça', { breed }, async () => {
      await apiRequest<LifeStageBreed>('/admin/life-stage/breeds', { token, method: 'POST', body: { market, ...breed } })
      await loadLifeStage()
      setNewBreed({ name_pt: '', name_en: '', size_class: 'giant' })
      setCreatingBreed(false)
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

  const updateFactor = (section: FactorSection, key: string, value: string) => {
    setDraft((current) => (current ? { ...current, [section]: { ...current[section], [key]: value === '' ? Number.NaN : Number(value) } } : current))
  }

  const updateGroup = (group: BreedGroup, text: string) => {
    setDraft((current) => (current ? { ...current, breed_groups: { ...current.breed_groups, [group]: text.split('\n') } } : current))
  }

  const isInvalid = (field: string) => invalid.some((item) => item === field || item.startsWith(`${field}:`))
  const shown = canWrite ? draft : parameters?.published.parameters ?? null
  const draftReadOnly = !canWrite || busy
  const limitHistory = overview?.history?.filter((event) => event.action === 'life_stage.limits.update')
  const breedHistory = overview?.history?.filter((event) => event.action.startsWith('life_stage.breed.'))

  const factorInput = (sectionKey: FactorSection, key: string, label: string) => {
    const range = sectionKey === 'nem' ? NEM_RANGE : FACTOR_RANGE
    const value = shown?.[sectionKey]?.[key]
    return (
      <input
        aria-label={label}
        type="number"
        inputMode="decimal"
        min={range.min}
        max={range.max}
        step="0.01"
        value={value === undefined || Number.isNaN(value) ? '' : value}
        disabled={draftReadOnly}
        aria-invalid={isInvalid(`${sectionKey}.${key}`) || undefined}
        onChange={(event) => updateFactor(sectionKey, key, event.target.value)}
      />
    )
  }

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
      {error && !creatingBreed ? <div className="alert" role="alert">{error}</div> : null}
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
        <div id="nutrition-panel-fases" role="tabpanel" aria-labelledby="nutrition-tab-fases">
          <form onSubmit={submitLimits}>
            <Section
              title={`Limites de ${MARKET_LABELS[market]}`}
              hint={<InfoHint id="help-preview" topic="a prévia" text={HELP.preview} />}
              description="Idade, em meses, em que o cão passa a adulto e a sênior, por porte."
            >
              {canWriteLimits && !canWrite ? <p className="readonly-note">Você pode alterar os limites de {MARKET_LABELS[market]}, o mercado em que é operador. A prévia mostra os pets afetados antes de salvar.</p> : null}
              {!canWriteLimits && hasPermission('nutrition.limits.write') ? <p className="readonly-note">Somente leitura: você não é operador de {MARKET_LABELS[market]}.</p> : null}
              {!canWriteLimits && !hasPermission('nutrition.limits.write') ? <p className="readonly-note">Somente leitura: os limites de fase são definidos pela veterinária e pelos operadores de cada mercado.</p> : null}
              <dl className="nutri-legend">
                <div><dt><Hinted id="help-adult-m" label="Adulto a partir de" text={HELP.adultFrom} /></dt></div>
                <div><dt><Hinted id="help-senior-m" label="Sênior a partir de" text={HELP.seniorFrom} end /></dt></div>
              </dl>
              {!overview ? <p className="muted" aria-busy="true">Carregando…</p> : (
                <div className="nutri-table-shell">
                  <table className="nutri-table nutri-limits">
                    <thead>
                      <tr>
                        <th scope="col"><Hinted id="help-size" label="Porte" text={HELP.sizeClass} /></th>
                        <th scope="col"><Hinted id="help-adult" label="Adulto a partir de (meses)" text={HELP.adultFrom} /></th>
                        <th scope="col"><Hinted id="help-senior" label="Sênior a partir de (meses)" text={HELP.seniorFrom} end /></th>
                      </tr>
                    </thead>
                    <tbody>
                      {SIZE_CLASSES.map((sizeClass) => (
                        <tr key={sizeClass}>
                          <th scope="row">{SIZE_CLASS_LABELS[sizeClass]}</th>
                          {(['adult', 'senior'] as const).map((stage) => {
                            const field = `${sizeClass}.${stage === 'adult' ? 'adult_from_months' : 'senior_from_months'}`
                            return (
                              <td key={stage}>
                                <span className="nutri-cell-label" aria-hidden="true">{stage === 'adult' ? 'Adulto a partir de' : 'Sênior a partir de'}</span>
                                <div className="nutri-number">
                                  <input
                                    aria-label={`${SIZE_CLASS_LABELS[sizeClass]}: ${stage === 'adult' ? 'adulto' : 'sênior'} a partir de`}
                                    aria-describedby={`limit-hint-${field}`}
                                    type="number"
                                    inputMode="numeric"
                                    min={MONTHS_RANGE.min}
                                    max={MONTHS_RANGE.max}
                                    step="1"
                                    value={limits[sizeClass][stage]}
                                    disabled={!canWriteLimits || busy}
                                    aria-invalid={isInvalid(field) || undefined}
                                    onChange={(event) => setLimits((current) => ({ ...current, [sizeClass]: { ...current[sizeClass], [stage]: event.target.value } }))}
                                  />
                                  <span className="nutri-unit" aria-hidden="true">meses</span>
                                </div>
                                <small id={`limit-hint-${field}`} className="ship-hint">{monthsLabel(limits[sizeClass][stage])}</small>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {canWriteLimits && overview ? (
                <div className="table-actions">
                  <button className="primary-button" type="submit" disabled={busy}>Salvar limites</button>
                </div>
              ) : null}
            </Section>
          </form>
          <Section title="Histórico de edições" hint={<InfoHint id="help-log-fases" topic="o histórico de edições" text={HELP.editLog} />} description={`Quem alterou os limites de ${MARKET_LABELS[market]}.`}>
            {overview ? <NutritionEditLog events={limitHistory} empty="Nenhuma alteração de limites registrada." /> : <p className="muted" aria-busy="true">Carregando…</p>}
          </Section>
        </div>
      ) : null}

      {tab === 'racas' ? (
        <div id="nutrition-panel-racas" role="tabpanel" aria-labelledby="nutrition-tab-racas">
          <Section
            title={`Raças com porte próprio em ${MARKET_LABELS[market]}`}
            hint={<InfoHint id="help-breeds" topic="raças com porte próprio" text={HELP.breedsTable} />}
            description="O porte desta tabela substitui o porte informado pelo cliente. Os nomes são comparados sem acento e sem maiúsculas."
            actions={canWriteBreeds ? (
              <button className="primary-button nutri-add-breed" type="button" disabled={busy || !overview} onClick={openNewBreed}>
                <span aria-hidden="true">+</span> Incluir raça
              </button>
            ) : undefined}
          >
            {canWriteBreeds && !canWrite ? <p className="readonly-note">Você pode incluir e editar raças de {MARKET_LABELS[market]}, o mercado em que é operador.</p> : null}
            {!canWriteBreeds && hasPermission('nutrition.breeds.write') ? <p className="readonly-note">Somente leitura: você não é operador de {MARKET_LABELS[market]}.</p> : null}
            <dl className="nutri-legend">
              <div><dt><Hinted id="help-names-m" label="Nomes" text={HELP.breedNames} /></dt></div>
              <div><dt><Hinted id="help-size-m" label="Porte" text={HELP.sizeClass} /></dt></div>
              <div><dt><Hinted id="help-status-m" label="Situação" text={HELP.breedStatus} end /></dt></div>
            </dl>
            {!overview ? <p className="muted" aria-busy="true">Carregando…</p> : overview.breeds.length === 0 ? (
              <p className="muted">Nenhuma raça cadastrada em {MARKET_LABELS[market]}.</p>
            ) : (
              <div className="nutri-table-shell">
                <table className="nutri-table nutri-breeds">
                  <thead>
                    <tr>
                      <th scope="col"><Hinted id="help-names" label="Nome em português" text={HELP.breedNames} /></th>
                      <th scope="col">Nome em inglês</th>
                      <th scope="col"><Hinted id="help-size-b" label="Porte" text={HELP.sizeClass} /></th>
                      <th scope="col"><Hinted id="help-status" label="Situação" text={HELP.breedStatus} end={!canWriteBreeds} /></th>
                      {canWriteBreeds ? <th scope="col"><span className="visually-hidden">Ações</span></th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {overview.breeds.map((breed) => (
                      <tr key={breed.id} className={breed.active ? undefined : 'is-inactive'}>
                        <td className="nutri-breed-name">{breed.namePt}</td>
                        <td className="nutri-breed-en"><span className="nutri-cell-label" aria-hidden="true">Inglês</span>{breed.nameEn}</td>
                        <td className="nutri-breed-size">
                          <span className="nutri-cell-label" aria-hidden="true">Porte</span>
                          {canWriteBreeds ? (
                            <select
                              className="nutri-select"
                              aria-label={`Porte de ${breed.namePt}`}
                              value={breed.sizeClass}
                              disabled={busy}
                              onChange={(event) => void saveBreed(breed, { size_class: event.target.value as SizeClass }, 'Porte alterado')}
                            >
                              {SIZE_CLASSES.map((sizeClass) => <option key={sizeClass} value={sizeClass}>{SIZE_CLASS_LABELS[sizeClass]}</option>)}
                            </select>
                          ) : SIZE_CLASS_LABELS[breed.sizeClass]}
                        </td>
                        <td className="nutri-breed-status"><span className={breed.active ? 'badge-success' : 'badge-warning'}>{breed.active ? 'Ativa' : 'Desativada'}</span></td>
                        {canWriteBreeds ? (
                          <td className="nutri-breed-action">
                            <button className="ghost-button" type="button" disabled={busy} aria-label={`${breed.active ? 'Desativar' : 'Reativar'} ${breed.namePt}`} onClick={() => void saveBreed(breed, { active: !breed.active }, breed.active ? 'Desativada' : 'Reativada')}>
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
          <Section title="Histórico de edições" hint={<InfoHint id="help-log-racas" topic="o histórico de edições" text={HELP.editLog} />} description={`Quem incluiu, alterou ou desativou raças de ${MARKET_LABELS[market]}.`}>
            {overview ? <NutritionEditLog events={breedHistory} empty="Nenhuma alteração de raça registrada." /> : <p className="muted" aria-busy="true">Carregando…</p>}
          </Section>
        </div>
      ) : null}

      {tab === 'fatores' ? (
        <div id="nutrition-panel-fatores" role="tabpanel" aria-labelledby="nutrition-tab-fatores">
          {!parameters || !shown ? <p className="muted" aria-busy="true">Carregando…</p> : (
            <>
              <Section
                title={canWrite ? (parameters.draft ? `Rascunho #${parameters.draft.id}` : 'Novo rascunho') : 'Conjunto publicado'}
                hint={<InfoHint id="help-draft" topic="rascunho e publicação" text={HELP.draft} />}
                description={`Publicado${parameters.published.id ? ` (#${parameters.published.id})` : ''} em ${parameters.published.publishedAt ? formatDate(parameters.published.publishedAt) : '—'}. Vale para os dois mercados.${canWrite && !parameters.draft ? ' O rascunho começa com os valores publicados.' : ''}`}
                actions={canWrite ? (
                  <div className="table-actions nutri-draft-actions">
                    {parameters.draft ? <button className="ghost-button" type="button" disabled={busy} onClick={() => void discardDraft()}>Descartar rascunho</button> : null}
                    <button className="ghost-button" type="button" disabled={busy} onClick={() => void saveDraft()}>Salvar rascunho</button>
                    {parameters.draft ? <button className="primary-button" type="button" disabled={busy} onClick={() => setPublishing(true)}>Publicar</button> : null}
                  </div>
                ) : undefined}
              >
                {canWrite && parameters.draft ? <p className="muted">Teste o rascunho no Simulador nutricional, com "Simular com o rascunho", antes de publicar.</p> : null}
                {!canWrite ? <p className="readonly-note">Somente leitura: os fatores são definidos pela veterinária.</p> : null}
                <p className="nutri-formula">
                  <Hinted id="help-factor" label="Como o fator vira gramas" text={HELP.factor} />
                  <span>Cão: kcal/dia = fator × peso<sup>0,75</sup> · Gato: fator × peso<sup>0,67</sup> (acima do peso: peso<sup>0,4</sup>) · g/dia = kcal/dia ÷ NEM × 1000</span>
                </p>
              </Section>
              <div className="segmented nutri-species" role="group" aria-label="Espécie">
                {SPECIES_OPTIONS.map((option) => (
                  <button key={option.id} type="button" aria-pressed={speciesOption.id === option.id} className={speciesOption.id === option.id ? 'active' : ''} onClick={() => setParam({ especie: option.id })}>
                    {option.label}
                  </button>
                ))}
              </div>
              {species === 'dog' ? (
                <>
                  {(['state', 'combination', 'combination_giant'] as const).map((sectionKey) => {
                    const section = FACTOR_SECTIONS.find((item) => item.key === sectionKey)!
                    return (
                      <Section key={sectionKey} title={section.title} hint={<InfoHint id={`help-${sectionKey}`} topic={section.title.toLowerCase()} text={HELP[sectionKey]} />} description={section.description}>
                        {sectionKey === 'state' ? (
                          <div className="ship-fields ship-fields-4 nutri-factor-grid">
                            {Object.keys(shown.state).map((key) => (
                              <label key={key} className="ship-field">
                                <span>{factorLabel('state', key)}</span>
                                {factorInput('state', key, factorLabel('state', key))}
                              </label>
                            ))}
                          </div>
                        ) : (
                          <div className="nutri-table-shell">
                            <table className="nutri-table nutri-matrix">
                              <thead>
                                <tr>
                                  <th scope="col">Castração e atividade</th>
                                  {COMBINATION_SCORES.map((score) => <th key={score.key} scope="col">{score.label}</th>)}
                                </tr>
                              </thead>
                              <tbody>
                                {COMBINATION_ROWS.map((row) => (
                                  <tr key={`${row.castrado}-${row.activity}`}>
                                    <th scope="row">{combinationRowLabel(row)}</th>
                                    {COMBINATION_SCORES.map((score) => {
                                      const key = `${row.castrado}-${row.activity}-${score.key}`
                                      return (
                                        <td key={score.key}>
                                          <span className="nutri-cell-label" aria-hidden="true">{score.short}</span>
                                          {factorInput(sectionKey, key, factorLabel(sectionKey, key))}
                                        </td>
                                      )
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </Section>
                    )
                  })}
                  <Section title="Raças gigantes" hint={<InfoHint id="help-groups" topic="raças gigantes" text={HELP.breedGroups} />} description="Usam a matriz de raças gigantes mesmo com 40 kg ou menos. Uma raça por linha, sem acento; uma raça só pode estar numa lista.">
                    <div className="ship-fields">
                      {BREED_GROUPS.map((group) => (
                        <label key={group} className="ship-field">
                          <span>{BREED_GROUP_LABELS[group]}</span>
                          <textarea
                            className="nutri-textarea"
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
                </>
              ) : (
                <Section title="Fatores de gatos" hint={<InfoHint id="help-base" topic="fatores de gatos" text={HELP.base} />} description="Gato com atividade alta usa o fator de gato ativo; os demais, o de ambiente interno. A matriz de castração × atividade × escore não vale para gatos.">
                  <div className="ship-fields ship-fields-4 nutri-factor-grid">
                    {Object.keys(shown.base).map((key) => (
                      <label key={key} className="ship-field">
                        <span>{factorLabel('base', key)}</span>
                        {factorInput('base', key, factorLabel('base', key))}
                      </label>
                    ))}
                  </div>
                  <p className="nutri-formula">
                    <span>Expoente do peso: <strong>0,67</strong>; gato acima do peso: <strong>0,4</strong>, com o mesmo fator.</span>
                  </p>
                </Section>
              )}
              <Section
                title={`NEM padrão de ${speciesOption.label.toLowerCase()}`}
                hint={<InfoHint id="help-nem" topic={`nem padrão de ${speciesOption.label.toLowerCase()}`} text={HELP.nem} />}
                description="Energia metabolizável do alimento, em kcal/kg, quando a receita não informa a dela."
              >
                <div className="ship-fields ship-fields-4 nutri-factor-grid">
                  {Object.keys(shown.nem).filter((key) => speciesOfKey(key) === species).map((key) => (
                    <label key={key} className="ship-field">
                      <span>{factorLabel('nem', key)}</span>
                      {factorInput('nem', key, factorLabel('nem', key))}
                    </label>
                  ))}
                </div>
              </Section>
              <Section title="Conjuntos publicados" hint={<InfoHint id="help-history" topic="conjuntos publicados" text={HELP.history} />} description="Um conjunto antigo volta como rascunho, para ser publicado de novo.">
                <div className="nutri-table-shell">
                  <table className="nutri-table nutri-sets">
                    <thead>
                      <tr><th scope="col">Conjunto</th><th scope="col">Situação</th><th scope="col">Publicado em</th>{canWrite ? <th scope="col"><span className="visually-hidden">Ações</span></th> : null}</tr>
                    </thead>
                    <tbody>
                      {parameters.history.map((set) => (
                        <tr key={set.id}>
                          <th scope="row">#{set.id}</th>
                          <td><span className={set.status === 'published' ? 'badge-success' : 'badge-info'}>{set.status === 'published' ? 'Publicado' : 'Anterior'}</span></td>
                          <td><span className="nutri-cell-label" aria-hidden="true">Publicado em</span>{set.publishedAt ? formatDate(set.publishedAt) : '—'}</td>
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
              <Section title="Histórico de edições" hint={<InfoHint id="help-log-fatores" topic="o histórico de edições" text={HELP.editLog} />} description="Quem salvou, descartou ou publicou rascunhos dos fatores.">
                <NutritionEditLog events={parameters.audit} empty="Nenhuma edição de fatores registrada." />
              </Section>
            </>
          )}
        </div>
      ) : null}

      <Dialog
        title={`Incluir raça em ${MARKET_LABELS[market]}`}
        description="Os dois nomes são obrigatórios: o cliente pode escrever a raça em qualquer um dos idiomas."
        open={creatingBreed && canWriteBreeds}
        onClose={closeNewBreed}
        footer={(
          <>
            <button className="ghost-button" type="button" onClick={closeNewBreed}>Cancelar</button>
            <button className="primary-button" type="submit" form="new-breed-form" disabled={busy}>{busy ? 'Incluindo…' : 'Incluir raça'}</button>
          </>
        )}
      >
        <form id="new-breed-form" className="ship-fields nutri-breed-form" onSubmit={submitNewBreed}>
          {error ? <div className="alert ship-field-wide" role="alert">{error}</div> : null}
          <label className="ship-field ship-field-wide">
            <span>Nome em português</span>
            <input value={newBreed.name_pt} maxLength={120} required disabled={busy} placeholder="Ex.: Mastim Napolitano" aria-invalid={isInvalid('name_pt') || undefined} onChange={(event) => setNewBreed((current) => ({ ...current, name_pt: event.target.value }))} />
          </label>
          <label className="ship-field ship-field-wide">
            <span>Nome em inglês</span>
            <input value={newBreed.name_en} maxLength={120} required disabled={busy} placeholder="Ex.: Neapolitan Mastiff" aria-invalid={isInvalid('name_en') || undefined} onChange={(event) => setNewBreed((current) => ({ ...current, name_en: event.target.value }))} />
          </label>
          <label className="ship-field ship-field-wide">
            <span className="label-with-hint">Porte<InfoHint id="help-new-size" topic="porte" text={HELP.sizeClass} /></span>
            <select value={newBreed.size_class} disabled={busy} onChange={(event) => setNewBreed((current) => ({ ...current, size_class: event.target.value as SizeClass }))}>
              {SIZE_CLASSES.map((sizeClass) => <option key={sizeClass} value={sizeClass}>{SIZE_CLASS_LABELS[sizeClass]}</option>)}
            </select>
          </label>
        </form>
      </Dialog>

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
