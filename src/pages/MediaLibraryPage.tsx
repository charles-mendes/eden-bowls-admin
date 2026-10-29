import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FiltersBar } from '../components/FiltersBar'
import { MarketSelect } from '../components/MarketSelect'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'
import { checkRecipePlanImage, fileToImagePayload, type ImagePayload } from '../lib/imageUpload'
import { defaultMarket, MARKET_LABELS, sessionMarkets, type MarketCode } from '../lib/markets'
import {
  MEDIA_UPLOAD_PATH,
  mediaActionPath,
  mediaFailure,
  mediaListPath,
  suggestPlanLink,
  usedByText,
  type MediaAsset,
  type MediaUpload,
} from '../lib/mediaLibrary'
import { recipeContentPath, type RecipeContent, type RecipeSummary } from '../lib/recipeContent'

type Notice = { tone: 'success' | 'error'; text: string } | null

type BatchStatus = { tone: 'success' | 'error'; text: string } | null

// One chosen file of the batch, with the link the operator confirms. recipeKey '' keeps it only in the library.
type BatchRow = {
  id: string
  fileName: string
  previewUrl: string
  payload: ImagePayload | null
  problem: string
  market: string
  recipeKey: string
  suggested: boolean
  status: BatchStatus
}

type RecipesByMarket = Record<string, Array<RecipeSummary & { planImageUrl?: string | null }>>

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
  // Kept with the market and view they belong to, so switching never shows the previous list.
  const [loaded, setLoaded] = useState<{ key: string; items: MediaAsset[] | null; error: string } | null>(null)
  const [reload, setReload] = useState(0)
  const [notice, setNotice] = useState<Notice>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [recipes, setRecipes] = useState<RecipesByMarket>({})
  const [rows, setRows] = useState<BatchRow[]>([])
  const [sending, setSending] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const listKey = `${market}:${archived}`

  useEffect(() => {
    if (!token || !market) return
    let cancelled = false
    apiRequest<{ items: MediaAsset[] }>(mediaListPath(market, { archived }), { token })
      .then((response) => { if (!cancelled) setLoaded({ key: listKey, items: response.items, error: '' }) })
      .catch((requestError) => {
        if (!cancelled) setLoaded({ key: listKey, items: null, error: mediaFailure(requestError, 'Falha ao carregar a biblioteca.') })
      })
    return () => {
      cancelled = true
    }
  }, [token, market, archived, listKey, reload])

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

  const setView = (next: { market?: string; archived?: boolean }) => {
    const params: Record<string, string> = {}
    const nextMarket = next.market ?? market
    if (nextMarket) params.market = nextMarket
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
      const check = await checkRecipePlanImage(file)
      const suggestion = suggestPlanLink(file.name, keys)
      const base = {
        id: `${Date.now()}-${index}`,
        fileName: file.name,
        previewUrl: URL.createObjectURL(file),
        market: suggestion.market ?? market,
        recipeKey: suggestion.recipeKey ?? '',
        suggested: Boolean(suggestion.recipeKey),
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
          body: { kind: 'plan', market: row.market, originalFilename: row.fileName, ...row.payload },
        })
        const stored = asset.duplicate ? 'Já estava na biblioteca' : 'Guardada na biblioteca'
        if (row.recipeKey) {
          await apiRequest<RecipeContent>(recipeContentPath(row.recipeKey, row.market, '/plan-image'), {
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

  return (
    <PageFrame
      title="Biblioteca de imagens"
      description="Miniaturas da embalagem no seletor de sabores da tela Plano, por mercado. Uma imagem nunca é apagada: trocar ou desvincular a miniatura de uma receita deixa a imagem aqui."
      actions={canWrite ? (
        <>
          <input
            ref={fileInput}
            id="media-batch-files"
            className="sr-only"
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => void chooseFiles(event.target.files)}
          />
          <label className="primary-button" htmlFor="media-batch-files">Enviar miniaturas</label>
        </>
      ) : null}
    >
      {current?.error ? <div className="alert" role="alert">{current.error}</div> : null}
      {notice ? (
        <div className={notice.tone === 'error' ? 'alert' : 'success'} role={notice.tone === 'error' ? 'alert' : 'status'}>
          {notice.text}
        </div>
      ) : null}

      {rows.length > 0 ? (
        <Section
          title="Confirmar envio"
          description="PNG, JPEG ou WebP quadrado de 400 × 400 px. O vínculo foi sugerido pelo nome do arquivo: confira o mercado e a receita de cada linha antes de confirmar. Nada foi enviado ainda."
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
                          <img className="media-thumb" src={row.previewUrl} alt={`Prévia de ${row.fileName}`} />
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
                          {(recipes[row.market] ?? []).map((recipe) => (
                            <option key={recipe.key} value={recipe.key}>{recipe.name}</option>
                          ))}
                        </select>
                        {row.payload && !row.recipeKey && !row.suggested ? (
                          <span className="field-hint">Sem sugestão pelo nome do arquivo.</span>
                        ) : null}
                        {target?.planImageUrl && !done ? (
                          <span className="field-hint">Substitui a miniatura atual. A atual continua na biblioteca.</span>
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

      <Section title="Filtros">
        <FiltersBar>
          <MarketSelect user={user} value={market} onChange={(value) => setView({ market: value })} />
          <div className="field">
            Mostrar
            <div className="tabs" role="group" aria-label="Situação das imagens">
              {[false, true].map((value) => (
                <button
                  key={String(value)}
                  type="button"
                  className={archived === value ? 'tab active' : 'tab'}
                  aria-pressed={archived === value}
                  onClick={() => setView({ archived: value })}
                >
                  {value ? 'Arquivadas' : 'Na biblioteca'}
                </button>
              ))}
            </div>
          </div>
        </FiltersBar>
      </Section>

      <Section
        title={archived ? 'Miniaturas arquivadas' : 'Miniaturas do plano'}
        description={items ? `${items.length} ${items.length === 1 ? 'imagem' : 'imagens'}` : 'Carregando a biblioteca.'}
      >
        {items && items.length === 0 ? (
          <p className="muted">{archived ? 'Nenhuma imagem arquivada neste mercado.' : 'Nenhuma miniatura neste mercado.'}</p>
        ) : null}
        <ul className="media-grid">
          {(items ?? []).map((asset) => (
            <li key={asset.id} className="media-card">
              <img className="media-thumb" src={asset.url} alt={asset.originalFilename} />
              <div className="cell-stack">
                <span className="media-name">{asset.originalFilename}</span>
                <span className="cell-meta">Enviada em {formatDate(asset.createdAt)}</span>
                {asset.usedBy.length > 0 ? (
                  <span className="badge-success">Em uso por {usedByText(asset.usedBy)}</span>
                ) : (
                  <span className="badge-neutral">{asset.archived ? 'Arquivada' : 'Sem uso'}</span>
                )}
              </div>
              {canWrite && asset.usedBy.length === 0 ? (
                <button className="ghost-button" type="button" disabled={busyId === asset.id} onClick={() => void toggleArchive(asset)}>
                  {asset.archived ? 'Restaurar' : 'Arquivar'}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>
    </PageFrame>
  )
}
