import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MediaLinkDialog } from '../components/MediaLinkDialog'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'
import { checkRecipeImage, checkRecipePlanImage, fileToImagePayload, type ImagePayload } from '../lib/imageUpload'
import { defaultMarket, MARKET_LABELS, sessionMarkets, type MarketCode } from '../lib/markets'
import {
  MEDIA_UPLOAD_PATH,
  mediaActionPath,
  mediaFailure,
  mediaListPath,
  suggestRecipeLink,
  usedByText,
  type MediaAsset,
  type MediaKind,
  type MediaUpload,
} from '../lib/mediaLibrary'
import { LIFE_STAGE_LABELS, recipeContentPath, type LifeStage, type RecipeContent, type RecipeSummary } from '../lib/recipeContent'

type Notice = { tone: 'success' | 'error'; text: string } | null

type BatchStatus = { tone: 'success' | 'error'; text: string } | null

// One chosen file of the batch, with the link the operator confirms. recipeKey '' keeps it only in the library.
type BatchRow = {
  id: string
  kind: MediaKind
  fileName: string
  previewUrl: string
  payload: ImagePayload | null
  problem: string
  market: string
  recipeKey: string
  suggested: boolean
  // Line the file name points to ("filhote-…" → puppy), to flag a recipe of another line.
  fileLine: LifeStage | null
  status: BatchStatus
}

const LIFE_STAGE_ORDER: LifeStage[] = ['adult', 'puppy', 'senior']

// Destaques first: they are the home screen of the store.
const KIND_ORDER: MediaKind[] = ['banner', 'plan']

type RecipesByMarket = Record<string, Array<RecipeSummary & { planImageUrl?: string | null }>>

// What changes between the home banners and the plan thumbnails: size check, link route and texts. The banners come
// first, since they are the home screen of the store.
const KINDS: Record<MediaKind, {
  tab: string
  check: (file: File) => ReturnType<typeof checkRecipeImage>
  linkSuffix: string
  current: (recipe: RecipesByMarket[string][number]) => string | null | undefined
  upload: string
  size: string
  title: string
  archivedTitle: string
  empty: string
  replaces: string
  emptyHint: string
  // Where the store shows this kind, for the hint under the type tabs.
  where: string
}> = {
  banner: {
    tab: 'Destaques',
    check: checkRecipeImage,
    linkSuffix: '/image',
    current: (recipe) => recipe.imageUrl,
    upload: 'Enviar destaques',
    size: 'PNG, JPEG ou WebP de 1024 × 636 px.',
    title: 'Destaques da tela inicial',
    archivedTitle: 'Destaques arquivados',
    empty: 'Nenhum destaque neste mercado.',
    replaces: 'Substitui o destaque atual. O atual continua na biblioteca.',
    emptyHint: 'Use Enviar destaques para guardar os banners e vinculá-los às receitas.',
    where: 'Aparecem na tela inicial da loja, no carrossel "Nossas receitas para cães", e no topo da página de cada receita. 1024 × 636 px.',
  },
  plan: {
    tab: 'Miniaturas',
    check: checkRecipePlanImage,
    linkSuffix: '/plan-image',
    current: (recipe) => recipe.planImageUrl,
    upload: 'Enviar miniaturas',
    size: 'PNG, JPEG ou WebP quadrado de 400 × 400 px.',
    title: 'Miniaturas do plano',
    archivedTitle: 'Miniaturas arquivadas',
    empty: 'Nenhuma miniatura neste mercado.',
    replaces: 'Substitui a miniatura atual. A atual continua na biblioteca.',
    emptyHint: 'Use Enviar miniaturas para guardar as embalagens e vinculá-las às receitas.',
    where: 'Aparecem na tela Plano da loja, no card de cada sabor ao montar o plano do pet. Quadradas, 400 × 400 px. Sem miniatura, o card usa o destaque da receita.',
  },
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString('pt-BR') : ''
}

function recipeLabel(recipes: RecipesByMarket, market: string, key: string) {
  const recipe = (recipes[market] ?? []).find((item) => item.key === key)
  return `${recipe?.name ?? key} (${market})`
}

export function MediaLibraryPage() {
  const { token, user, hasPermission } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const canWrite = hasPermission('catalog.write')
  const allowed = sessionMarkets(user)
  const requested = (searchParams.get('market') || '').toUpperCase() as MarketCode
  const market = allowed.includes(requested) ? requested : (defaultMarket(user) ?? '')
  const archived = searchParams.get('archived') === 'true'
  const kind: MediaKind = searchParams.get('kind') === 'plan' ? 'plan' : 'banner'
  const kindText = KINDS[kind]
  // Kept with the market and view they belong to, so switching never shows the previous list.
  const [loaded, setLoaded] = useState<{ key: string; items: MediaAsset[] | null; error: string } | null>(null)
  const [reload, setReload] = useState(0)
  const [notice, setNotice] = useState<Notice>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [recipes, setRecipes] = useState<RecipesByMarket>({})
  const [rows, setRows] = useState<BatchRow[]>([])
  const [sending, setSending] = useState(false)
  // Library image whose recipe links are being edited, and why the recipes of its market did not load.
  const [linking, setLinking] = useState<number | null>(null)
  const [recipesError, setRecipesError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const listKey = `${market}:${kind}:${archived}`

  useEffect(() => {
    if (!token || !market) return
    let cancelled = false
    apiRequest<{ items: MediaAsset[] }>(mediaListPath(market, { archived, kind }), { token })
      .then((response) => { if (!cancelled) setLoaded({ key: listKey, items: response.items, error: '' }) })
      .catch((requestError) => {
        if (!cancelled) setLoaded({ key: listKey, items: null, error: mediaFailure(requestError, 'Falha ao carregar a biblioteca.') })
      })
    return () => {
      cancelled = true
    }
  }, [token, market, archived, kind, listKey, reload])

  // Preview URLs of the batch, revoked when the list is replaced or discarded and when the page closes.
  const previewUrls = useRef<string[]>([])
  const replaceRows = (next: BatchRow[]) => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url))
    previewUrls.current = next.map((row) => row.previewUrl)
    setRows(next)
  }
  useEffect(() => () => previewUrls.current.forEach((url) => URL.revokeObjectURL(url)), [])

  const current = loaded?.key === listKey ? loaded : null
  const items = current?.items ?? null

  const setView = (next: { market?: string; archived?: boolean; kind?: MediaKind }) => {
    const params: Record<string, string> = {}
    const nextMarket = next.market ?? market
    if (nextMarket) params.market = nextMarket
    if ((next.kind ?? kind) === 'plan') params.kind = 'plan'
    if (next.archived ?? archived) params.archived = 'true'
    setSearchParams(params)
  }

  const toggleArchive = async (asset: MediaAsset) => {
    if (!token || busyId) return
    setNotice(null)
    try {
      setBusyId(asset.id)
      await apiRequest<MediaAsset>(mediaActionPath(asset.id, asset.archived ? 'restore' : 'archive'), { token, method: 'POST' })
      setNotice({
        tone: 'success',
        text: asset.archived
          ? `${asset.originalFilename} voltou para a biblioteca.`
          : `${asset.originalFilename} foi arquivada. O arquivo continua guardado e pode ser restaurado em Arquivadas.`,
      })
      setReload((value) => value + 1)
    } catch (requestError) {
      setNotice({ tone: 'error', text: mediaFailure(requestError, 'Falha ao atualizar a imagem.') })
    } finally {
      setBusyId(null)
    }
  }

  const moveTabFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    const next = KIND_ORDER[(KIND_ORDER.indexOf(kind) + 1) % KIND_ORDER.length]
    setView({ kind: next, archived: false })
    document.getElementById(`media-tab-${next}`)?.focus()
  }

  const openLinks = async (asset: MediaAsset) => {
    setNotice(null)
    setRecipesError('')
    setLinking(asset.id)
    try {
      await loadRecipes()
    } catch (requestError) {
      setRecipesError(mediaFailure(requestError, 'Falha ao carregar as receitas.'))
    }
  }

  // Recipes of every session market, for the suggested links and the recipe choice of each row.
  const loadRecipes = async () => {
    if (!token) return {}
    const entries = await Promise.all(allowed.map(async (code) => {
      const response = await apiRequest<{ items: RecipesByMarket[string] }>(`/admin/catalog/recipe-content?market=${encodeURIComponent(code)}`, { token })
      return [code, response.items] as const
    }))
    const byMarket = Object.fromEntries(entries) as RecipesByMarket
    setRecipes(byMarket)
    return byMarket
  }

  const chooseFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setNotice(null)
    let byMarket: RecipesByMarket
    try {
      byMarket = await loadRecipes()
    } catch (requestError) {
      setNotice({ tone: 'error', text: mediaFailure(requestError, 'Falha ao carregar as receitas.') })
      return
    }
    const keys = Object.fromEntries(Object.entries(byMarket).map(([code, list]) => [code, list.map((item) => item.key)]))
    const next = await Promise.all([...files].map(async (file, index): Promise<BatchRow> => {
      const check = await kindText.check(file)
      const suggestion = suggestRecipeLink(file.name, keys)
      const base = {
        id: `${Date.now()}-${index}`,
        kind,
        fileName: file.name,
        previewUrl: URL.createObjectURL(file),
        market: suggestion.market ?? market,
        recipeKey: suggestion.recipeKey ?? '',
        suggested: Boolean(suggestion.recipeKey),
        fileLine: suggestion.line,
        status: null,
      }
      if (!check.ok) return { ...base, payload: null, problem: check.message }
      try {
        return { ...base, payload: await fileToImagePayload(file), problem: '' }
      } catch (readError) {
        return { ...base, payload: null, problem: readError instanceof Error ? readError.message : 'Falha ao ler a imagem.' }
      }
    }))
    replaceRows(next)
    if (fileInput.current) fileInput.current.value = ''
  }

  const updateRow = (id: string, change: Partial<BatchRow>) => {
    setRows((list) => list.map((row) => (row.id === id ? { ...row, ...change } : row)))
  }

  const removeRow = (id: string) => setRows((list) => list.filter((row) => row.id !== id))

  const pending = rows.filter((row) => row.payload && row.status?.tone !== 'success')
  const linkCounts = new Map<string, number>()
  for (const row of pending) {
    if (row.recipeKey) linkCounts.set(`${row.market}:${row.recipeKey}`, (linkCounts.get(`${row.market}:${row.recipeKey}`) ?? 0) + 1)
  }
  const rowProblem = (row: BatchRow) => {
    if (row.problem) return row.problem
    if (!allowed.includes(row.market as MarketCode)) return `O mercado ${row.market} está fora da sua sessão.`
    if (row.recipeKey && (linkCounts.get(`${row.market}:${row.recipeKey}`) ?? 0) > 1) {
      return `Outra imagem da lista já vai para ${recipeLabel(recipes, row.market, row.recipeKey)}.`
    }
    return ''
  }
  const blocked = pending.some((row) => rowProblem(row))

  const sendBatch = async () => {
    if (!token || sending || blocked || pending.length === 0) return
    setSending(true)
    for (const row of pending) {
      try {
        const asset = await apiRequest<MediaUpload>(MEDIA_UPLOAD_PATH, {
          token,
          method: 'POST',
          body: { kind: row.kind, market: row.market, originalFilename: row.fileName, ...row.payload },
        })
        const stored = asset.duplicate ? 'Já estava na biblioteca' : 'Guardada na biblioteca'
        if (row.recipeKey) {
          await apiRequest<RecipeContent>(recipeContentPath(row.recipeKey, row.market, KINDS[row.kind].linkSuffix), {
            token,
            method: 'PUT',
            body: { assetId: asset.id },
          })
          updateRow(row.id, { status: { tone: 'success', text: `${stored} e vinculada a ${recipeLabel(recipes, row.market, row.recipeKey)}.` } })
        } else {
          updateRow(row.id, { status: { tone: 'success', text: `${stored}.` } })
        }
      } catch (requestError) {
        updateRow(row.id, { status: { tone: 'error', text: mediaFailure(requestError, 'Falha ao enviar a imagem.') } })
      }
    }
    setSending(false)
    setReload((value) => value + 1)
  }

  const linkAsset = linking ? (items ?? []).find((asset) => asset.id === linking) ?? null : null

  return (
    <PageFrame
      title="Biblioteca de imagens"
      description="Imagens das receitas na loja, por mercado. Uma imagem nunca é apagada: trocar ou desvincular a imagem de uma receita deixa a imagem aqui."
      actions={allowed.length > 1 ? (
        <div className="segmented" role="group" aria-label="Mercado">
          {allowed.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={market === option}
              className={market === option ? 'active' : ''}
              disabled={sending}
              onClick={() => setView({ market: option })}
            >
              {MARKET_LABELS[option]}
            </button>
          ))}
        </div>
      ) : undefined}
    >
      <div className="page-tabs" role="tablist" aria-label="Tipo de imagem" onKeyDown={moveTabFocus}>
        {KIND_ORDER.map((value) => (
          <button
            key={value}
            id={`media-tab-${value}`}
            type="button"
            role="tab"
            aria-selected={kind === value}
            aria-controls={`media-panel-${value}`}
            tabIndex={kind === value ? 0 : -1}
            className={kind === value ? 'page-tab active' : 'page-tab'}
            disabled={sending}
            onClick={() => setView({ kind: value, archived: false })}
          >
            {KINDS[value].tab}
          </button>
        ))}
      </div>

      <div id={`media-panel-${kind}`} role="tabpanel" aria-labelledby={`media-tab-${kind}`}>
        {current?.error ? <div className="alert" role="alert">{current.error}</div> : null}
        {notice ? (
          <div className={notice.tone === 'error' ? 'alert' : 'success'} role={notice.tone === 'error' ? 'alert' : 'status'}>
            {notice.text}
          </div>
        ) : null}

        {rows.length > 0 ? (
          <Section
            title="Confirmar envio"
            description={`${KINDS[rows[0].kind].size} O vínculo foi sugerido pelo nome do arquivo: confira o mercado e a receita de cada linha antes de confirmar. Nada foi enviado ainda.`}
          >
            <div className="table-shell table-scroll">
              <table className="media-batch-table">
                <thead>
                  <tr>
                    <th>Imagem</th>
                    <th>Mercado</th>
                    <th>Receita</th>
                    <th>Situação</th>
                    <th aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const problem = row.payload && row.status?.tone !== 'success' ? rowProblem(row) : row.problem
                    const done = row.status?.tone === 'success'
                    const target = (recipes[row.market] ?? []).find((item) => item.key === row.recipeKey)
                    return (
                      <tr key={row.id}>
                        <td>
                          <div className="media-batch-file">
                            <img className={row.kind === 'banner' ? 'media-thumb media-thumb-banner' : 'media-thumb'} src={row.previewUrl} alt={`Prévia de ${row.fileName}`} />
                            <span className="cell-meta">{row.fileName}</span>
                          </div>
                        </td>
                        <td>
                          <select
                            aria-label={`Mercado de ${row.fileName}`}
                            value={row.market}
                            disabled={sending || done || !row.payload}
                            onChange={(event) => updateRow(row.id, { market: event.target.value, recipeKey: '', suggested: false })}
                          >
                            {allowed.includes(row.market as MarketCode) ? null : <option value={row.market}>{row.market}</option>}
                            {allowed.map((code) => <option key={code} value={code}>{MARKET_LABELS[code]}</option>)}
                          </select>
                        </td>
                        <td>
                          <select
                            aria-label={`Receita de ${row.fileName}`}
                            value={row.recipeKey}
                            disabled={sending || done || !row.payload}
                            onChange={(event) => updateRow(row.id, { recipeKey: event.target.value, suggested: false })}
                          >
                            <option value="">Só guardar na biblioteca</option>
                            {LIFE_STAGE_ORDER.map((stage) => {
                              const options = (recipes[row.market] ?? []).filter((recipe) => recipe.lifeStage === stage)
                              return options.length ? (
                                <optgroup key={stage} label={LIFE_STAGE_LABELS[stage]}>
                                  {options.map((recipe) => <option key={recipe.key} value={recipe.key}>{recipe.name}</option>)}
                                </optgroup>
                              ) : null
                            })}
                          </select>
                          {target ? (
                            <span className="field-hint">Linha {LIFE_STAGE_LABELS[target.lifeStage]} · {target.name} ({row.market})</span>
                          ) : null}
                          {target && row.fileLine && target.lifeStage !== row.fileLine && !done ? (
                            <span className="field-hint field-hint-warning">
                              O nome do arquivo indica a linha {LIFE_STAGE_LABELS[row.fileLine]}, mas a receita escolhida é da linha {LIFE_STAGE_LABELS[target.lifeStage]}.
                            </span>
                          ) : null}
                          {row.payload && !row.recipeKey && !row.suggested ? (
                            <span className="field-hint">Sem sugestão pelo nome do arquivo.</span>
                          ) : null}
                          {target && KINDS[row.kind].current(target) && !done ? (
                            <span className="field-hint">{KINDS[row.kind].replaces}</span>
                          ) : null}
                        </td>
                        <td>
                          {row.status ? (
                            <span className={row.status.tone === 'success' ? 'badge-success' : 'badge-warning'}>{row.status.text}</span>
                          ) : problem ? (
                            <span className="badge-warning">{problem}</span>
                          ) : (
                            <span className="badge-neutral">Pronta para enviar</span>
                          )}
                        </td>
                        <td>
                          {!done && !sending ? (
                            <button className="ghost-button" type="button" onClick={() => removeRow(row.id)}>
                              Tirar da lista
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="inline-actions">
              <button className="primary-button" type="button" disabled={sending || blocked || pending.length === 0} onClick={() => void sendBatch()}>
                {sending ? 'Enviando…' : `Confirmar e enviar ${pending.length} ${pending.length === 1 ? 'imagem' : 'imagens'}`}
              </button>
              <button className="ghost-button" type="button" disabled={sending} onClick={() => replaceRows([])}>
                {pending.length === 0 ? 'Fechar' : 'Descartar lista'}
              </button>
            </div>
          </Section>
        ) : null}

        <Section
          title={archived ? kindText.archivedTitle : kindText.title}
          description={kindText.where}
          actions={canWrite ? (
            <div className="media-upload">
              <input
                ref={fileInput}
                id="media-batch-files"
                className="sr-only"
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => void chooseFiles(event.target.files)}
              />
              <label className={sending ? 'primary-button disabled' : 'primary-button'} htmlFor="media-batch-files">{kindText.upload}</label>
            </div>
          ) : undefined}
        >
          <div className="media-toolbar">
            <p className="cell-meta">
              {items ? `${items.length} ${items.length === 1 ? 'imagem' : 'imagens'} em ${MARKET_LABELS[market as MarketCode] ?? market}` : 'Carregando a biblioteca.'}
            </p>
            <div className="segmented" role="group" aria-label="Situação das imagens">
              {[false, true].map((value) => (
                <button
                  key={String(value)}
                  type="button"
                  className={archived === value ? 'active' : ''}
                  aria-pressed={archived === value}
                  onClick={() => setView({ archived: value })}
                >
                  {value ? 'Arquivadas' : 'Na biblioteca'}
                </button>
              ))}
            </div>
          </div>
          {items && items.length === 0 ? (
            <div className="media-empty">
              <p className="muted">{archived ? 'Nenhuma imagem arquivada neste mercado.' : kindText.empty}</p>
              {!archived && canWrite ? <p className="field-hint">{kindText.emptyHint}</p> : null}
            </div>
          ) : null}
          <ul className="media-grid">
            {(items ?? []).map((asset) => (
              <li key={asset.id} className="media-card">
                <img className={asset.kind === 'banner' ? 'media-thumb media-thumb-banner' : 'media-thumb'} src={asset.url} alt={asset.originalFilename} />
                <div className="cell-stack">
                  <span className="media-name">{asset.originalFilename}</span>
                  <span className="cell-meta">Enviada em {formatDate(asset.createdAt)}</span>
                  {asset.usedBy.length > 0 ? (
                    <span className="badge-success">Em uso por {usedByText(asset.usedBy)}</span>
                  ) : (
                    <span className="badge-neutral">{asset.archived ? 'Arquivada' : 'Sem uso'}</span>
                  )}
                </div>
                {canWrite ? (
                  <div className="media-card-actions">
                    {!asset.archived ? (
                      <button className="ghost-button" type="button" disabled={busyId === asset.id} onClick={() => void openLinks(asset)}>
                        {asset.usedBy.length > 0 ? 'Editar vínculo' : 'Vincular a uma receita'}
                      </button>
                    ) : null}
                    {asset.usedBy.length === 0 ? (
                      <button className={asset.archived ? 'ghost-button' : 'link-button'} type="button" disabled={busyId === asset.id} onClick={() => void toggleArchive(asset)}>
                        {asset.archived ? 'Restaurar' : 'Arquivar'}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <MediaLinkDialog
        token={token}
        asset={linkAsset}
        recipes={linkAsset ? recipes[linkAsset.market] ?? null : null}
        recipesError={recipesError}
        onClose={() => {
          setLinking(null)
          setReload((value) => value + 1)
        }}
        onChanged={(asset) => {
          setLoaded((list) => (list && list.items ? { ...list, items: list.items.map((item) => (item.id === asset.id ? asset : item)) } : list))
          void loadRecipes().catch(() => undefined)
        }}
      />
    </PageFrame>
  )
}
