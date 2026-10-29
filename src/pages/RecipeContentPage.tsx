import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Dialog } from '../components/Dialog'
import { RecipeLibraryImageSection } from '../components/RecipeLibraryImageSection'
import { RecipePresentationSection } from '../components/RecipePresentationSection'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'
import {
  LABEL_STATUS_TEXT,
  LIFE_STAGE_LABELS,
  labelMissingText,
  recipeContentFailure,
  recipeContentPath,
  listToParagraphs,
  paragraphsToList,
  splitPastedList,
  type RecipeContent,
  type LifeStage,
  type RecipeLabel,
} from '../lib/recipeContent'

type Notice = { tone: 'success' | 'error'; text: string } | null

type LabelTextField = 'productName' | 'netWeight' | 'freshnessNote' | 'energyKg' | 'energyPackage' | 'manufacturer'
type LabelListField = 'ingredients' | 'notices' | 'storage' | 'feeding'

const TEXT_FIELDS: Array<{ field: LabelTextField; label: string }> = [
  { field: 'productName', label: 'Nome do produto' },
  { field: 'netWeight', label: 'Peso líquido' },
  { field: 'freshnessNote', label: 'Nota de frescor' },
  { field: 'energyKg', label: 'kcal/kg' },
  { field: 'energyPackage', label: 'kcal por embalagem' },
  { field: 'manufacturer', label: 'Fabricante' },
]

// Ingredients are short and come pasted from the label, one input each; the other lists hold sentences,
// edited as paragraphs of one textarea.
const LIST_FIELDS: Array<{ field: LabelListField; label: string; item: string; paragraphs?: boolean; pasteable?: boolean }> = [
  { field: 'ingredients', label: 'Ingredientes', item: 'Ingrediente', pasteable: true },
  { field: 'notices', label: 'Avisos', item: 'Aviso', paragraphs: true },
  { field: 'storage', label: 'Armazenamento', item: 'Armazenamento', paragraphs: true },
  { field: 'feeding', label: 'Modo de servir', item: 'Modo de servir', paragraphs: true },
]

// One textarea for a list of sentences. The text typed is kept as is (blank lines included) and is
// replaced only when the list changes from outside, such as a label loaded after the page.
function ParagraphsEditor({ label, values, disabled, onChange }: {
  label: string
  values: string[]
  disabled: boolean
  onChange: (values: string[]) => void
}) {
  const [text, setText] = useState(() => listToParagraphs(values))
  const parsed = paragraphsToList(text)
  if (parsed.join('\u0000') !== values.join('\u0000')) {
    setText(listToParagraphs(values))
  }
  const count = parsed.length

  return (
    <label className="label-paragraphs">
      <span className="label-paragraphs-title">{label}</span>
      <textarea
        aria-label={label}
        aria-describedby={`paragraphs-${label}-hint`}
        rows={Math.max(4, text.split('\n').length + 1)}
        value={text}
        disabled={disabled}
        onChange={(event) => {
          setText(event.target.value)
          onChange(paragraphsToList(event.target.value))
        }}
      />
      <span id={`paragraphs-${label}-hint`} className="field-hint">
        Um parágrafo por item, separados por uma linha em branco. {count === 1 ? '1 item' : `${count} itens`}.
      </span>
    </label>
  )
}

function labelForm(label: Partial<RecipeLabel> | null): RecipeLabel {
  return {
    productName: label?.productName ?? '',
    netWeight: label?.netWeight ?? '',
    freshnessNote: label?.freshnessNote ?? '',
    ingredients: [...(label?.ingredients ?? [])],
    analysis: (label?.analysis ?? []).map((row) => ({ ...row })),
    energyKg: label?.energyKg ?? '',
    energyPackage: label?.energyPackage ?? '',
    notices: [...(label?.notices ?? [])],
    storage: [...(label?.storage ?? [])],
    feeding: [...(label?.feeding ?? [])],
    manufacturer: label?.manufacturer ?? '',
    manufacturerLocation: label?.manufacturerLocation ?? '',
  }
}

// Blank list rows are dropped before saving; the API trims the rest.
function labelPayload(form: RecipeLabel): RecipeLabel {
  const list = (items: string[]) => items.map((item) => item.trim()).filter(Boolean)
  return {
    ...form,
    ingredients: list(form.ingredients),
    notices: list(form.notices),
    storage: list(form.storage),
    feeding: list(form.feeding),
    analysis: form.analysis.filter((row) => row.nutrient.trim() || row.value.trim()),
  }
}

function ListEditor({ label, item, values, disabled, pasteable = false, onChange }: {
  label: string
  item: string
  values: string[]
  disabled: boolean
  pasteable?: boolean
  onChange: (values: string[]) => void
}) {
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const pasted = splitPastedList(pasteText)
  const addPasted = () => {
    onChange([...values.filter((value) => value.trim()), ...pasted])
    setPasteText('')
    setPasteOpen(false)
  }

  return (
    <fieldset className="label-list">
      <legend>{label}</legend>
      {values.length === 0 ? <p className="field-hint">Nenhum item.</p> : null}
      {values.map((value, index) => (
        <div className="label-list-row" key={index}>
          <input
            aria-label={`${item} ${index + 1}`}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(values.map((current, at) => (at === index ? event.target.value : current)))}
          />
          {!disabled ? (
            <button
              className="ghost-button"
              type="button"
              aria-label={`Remover ${item.toLowerCase()} ${index + 1}`}
              onClick={() => onChange(values.filter((_, at) => at !== index))}
            >
              Remover
            </button>
          ) : null}
        </div>
      ))}
      {!disabled && pasteable && pasteOpen ? (
        <div className="label-paste">
          <textarea
            aria-label={`Colar lista de ${label.toLowerCase()}`}
            aria-describedby={`paste-${item}-hint`}
            rows={3}
            value={pasteText}
            placeholder="Arroz integral, Carne bovina, Lentilha, Abobrinha…"
            onChange={(event) => setPasteText(event.target.value)}
          />
          <span id={`paste-${item}-hint`} className="field-hint">
            Separe por vírgula, ponto e vírgula ou uma por linha. {pasted.length === 1 ? '1 item' : `${pasted.length} itens`} a adicionar.
          </span>
          <div className="inline-actions">
            <button className="primary-button" type="button" disabled={pasted.length === 0} onClick={addPasted}>
              Adicionar à lista
            </button>
            <button className="ghost-button" type="button" onClick={() => { setPasteText(''); setPasteOpen(false) }}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
      {!disabled ? (
        <div className="inline-actions">
          <button className="link-button" type="button" onClick={() => onChange([...values, ''])}>
            Adicionar {item.toLowerCase()}
          </button>
          {pasteable && !pasteOpen ? (
            <button className="link-button" type="button" onClick={() => setPasteOpen(true)}>
              Colar lista
            </button>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  )
}

export function RecipeContentPage() {
  const { token, hasPermission } = useAuth()
  const { market: marketParam = '', recipeKey = '' } = useParams()
  const navigate = useNavigate()
  const canWrite = hasPermission('catalog.write')
  const [content, setContent] = useState<RecipeContent | null>(null)
  const [loadError, setLoadError] = useState('')
  const [label, setLabel] = useState<RecipeLabel>(() => labelForm(null))
  const [labelNotice, setLabelNotice] = useState<Notice>(null)
  const [savingLabel, setSavingLabel] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [lifeStage, setLifeStage] = useState<LifeStage>('adult')
  const [lifeStageNotice, setLifeStageNotice] = useState<Notice>(null)
  const [headerNotice, setHeaderNotice] = useState<Notice>(null)
  const [busy, setBusy] = useState(false)

  const market = marketParam.toUpperCase()
  const listPath = `/catalog/recipes?market=${encodeURIComponent(market)}`

  useEffect(() => {
    if (!token || !market || !recipeKey) return
    let cancelled = false
    const load = async () => {
      try {
        const loadedContent = await apiRequest<RecipeContent>(recipeContentPath(recipeKey, market), { token })
        if (!cancelled) {
          setContent(loadedContent)
          setLabel(labelForm(loadedContent.label))
          setLifeStage(loadedContent.lifeStage ?? 'adult')
        }
      } catch (requestError) {
        if (!cancelled) setLoadError(recipeContentFailure(requestError, 'Falha ao carregar o conteúdo da receita.'))
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [token, market, recipeKey])

  const openRename = () => {
    setRenameValue(content?.name ?? '')
    setHeaderNotice(null)
    setRenameOpen(true)
  }

  const renameRecipe = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!token || !canWrite || busy) return
    try {
      setBusy(true)
      const saved = await apiRequest<RecipeContent>(recipeContentPath(recipeKey, market), {
        token,
        method: 'PATCH',
        body: { name: renameValue.trim() },
      })
      setContent(saved)
      setRenameOpen(false)
      setHeaderNotice({ tone: 'success', text: 'Receita renomeada.' })
    } catch (requestError) {
      setHeaderNotice({ tone: 'error', text: recipeContentFailure(requestError, 'Falha ao renomear a receita.') })
      setRenameOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const saveLifeStage = async () => {
    if (!token || !canWrite || busy || !content) return
    try {
      setBusy(true)
      const saved = await apiRequest<RecipeContent>(recipeContentPath(recipeKey, market), {
        token,
        method: 'PATCH',
        body: { lifeStage },
      })
      setContent(saved)
      setLifeStageNotice({ tone: 'success', text: `Fase salva: ${LIFE_STAGE_LABELS[saved.lifeStage]}.` })
    } catch (requestError) {
      setLifeStageNotice({ tone: 'error', text: recipeContentFailure(requestError, 'Falha ao salvar a fase da receita.') })
    } finally {
      setBusy(false)
    }
  }

  const deleteRecipe = async () => {
    if (!token || !canWrite || busy || !content) return
    const confirmed = window.confirm(`Excluir a receita "${content.name}"? A imagem da tela inicial e o rótulo cadastrados também saem; a miniatura do plano continua na Biblioteca de imagens. Não pode ser desfeito.`)
    if (!confirmed) return
    try {
      setBusy(true)
      await apiRequest(recipeContentPath(recipeKey, market), { token, method: 'DELETE' })
      navigate(listPath)
    } catch (requestError) {
      setHeaderNotice({ tone: 'error', text: recipeContentFailure(requestError, 'Falha ao excluir a receita.') })
      setBusy(false)
    }
  }

  const updateLabel = (patch: Partial<RecipeLabel>) => setLabel((current) => ({ ...current, ...patch }))

  const saveLabel = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !market || !canWrite || savingLabel) return
    try {
      setSavingLabel(true)
      const saved = await apiRequest<RecipeContent>(recipeContentPath(recipeKey, market, '/label'), {
        token,
        method: 'PUT',
        body: { label: labelPayload(label) },
      })
      setContent(saved)
      setLabel(labelForm(saved.label))
      setLabelNotice({
        tone: 'success',
        text: saved.labelStatus === 'complete' ? 'Rótulo salvo e completo.' : 'Rótulo salvo como rascunho.',
      })
    } catch (requestError) {
      setLabelNotice({ tone: 'error', text: recipeContentFailure(requestError, 'Falha ao salvar o rótulo.') })
    } finally {
      setSavingLabel(false)
    }
  }

  const labelBadge = content?.labelStatus === 'complete'
    ? 'badge-success'
    : content?.labelStatus === 'incomplete' ? 'badge-warning' : 'badge-neutral'
  const labelLanguage = market === 'US' ? 'Rótulo em inglês · US' : 'Rótulo em português · BR'
  const readOnlyLabel = !canWrite

  const sharedCount = content?.variations.length ?? 0

  return (
    <PageFrame
      eyebrow="Catálogo · Receitas"
      title={content?.name || recipeKey}
      description={`Receita ${recipeKey} · mercado ${market}. Apresentação, imagem e rótulo valem para todas as variações do mercado vinculadas a esta receita.`}
      actions={(
        <div className="inline-actions">
          {canWrite && content ? (
            <button className="ghost-button" type="button" onClick={openRename} disabled={busy}>Renomear</button>
          ) : null}
          {canWrite && content && content.variations.length === 0 ? (
            <button className="danger-button" type="button" onClick={() => void deleteRecipe()} disabled={busy}>Excluir receita</button>
          ) : null}
          <Link className="ghost-button" to={listPath}>Voltar às receitas</Link>
        </div>
      )}
    >
      {loadError ? <div className="alert" role="alert">{loadError}</div> : null}
      {headerNotice ? (
        <div className={headerNotice.tone === 'error' ? 'alert' : 'success'} role={headerNotice.tone === 'error' ? 'alert' : 'status'}>
          {headerNotice.text}
        </div>
      ) : null}

      {content ? (
        <div className="stack product-detail">
          <Section
            title="Fase da vida"
            description={`A receita é ${LIFE_STAGE_LABELS[content.lifeStage ?? 'adult'].toLowerCase()}. Todas as variações vinculadas seguem esta fase na loja, no plano e no cálculo nutricional.`}
          >
            {lifeStageNotice ? (
              <div className={lifeStageNotice.tone === 'error' ? 'alert' : 'success'} role={lifeStageNotice.tone === 'error' ? 'alert' : 'status'}>
                {lifeStageNotice.text}
              </div>
            ) : null}
            <div className="inline-actions">
              <select
                aria-label="Fase da vida"
                value={lifeStage}
                disabled={!canWrite || busy}
                onChange={(event) => { setLifeStage(event.target.value as LifeStage); setLifeStageNotice(null) }}
              >
                {(Object.keys(LIFE_STAGE_LABELS) as LifeStage[]).map((stage) => (
                  <option key={stage} value={stage}>{LIFE_STAGE_LABELS[stage]}</option>
                ))}
              </select>
              {canWrite ? (
                <button className="primary-button" type="button" onClick={() => void saveLifeStage()} disabled={busy || lifeStage === content.lifeStage}>
                  Salvar fase
                </button>
              ) : null}
            </div>
          </Section>

          <Section
            title="Variações que usam este conteúdo"
            description={`${sharedCount === 1 ? '1 variação' : `${sharedCount} variações`} com Receita (conteúdo) ${recipeKey}. Para vincular ou desvincular, edite a variação no produto.`}
          >
            {sharedCount === 0 ? (
              <p className="field-hint">
                Nenhuma variação usa esta receita. Para vincular, abra o produto, edite a variação e escolha esta receita no campo Receita (conteúdo).
              </p>
            ) : null}
            <ul className="recipe-variations">
              {content.variations.map((item) => (
                <li key={item.id}>
                  {item.productId ? (
                    <Link
                      className="link-button"
                      to={`/catalog/products/${item.productId}?variation=${encodeURIComponent(item.id)}`}
                      aria-label={`Abrir variação ${item.name || item.sku}`}
                    >
                      {item.name || item.sku}
                    </Link>
                  ) : (
                    <span>{item.name || item.sku}</span>
                  )}
                  <span className="cell-meta mono">{item.sku}</span>
                  {item.productId ? (
                    <Link className="link-button" to={`/catalog/products/${item.productId}`}>{item.productName || 'Produto'}</Link>
                  ) : null}
                  <span className={item.active ? 'badge-success' : 'badge-neutral'}>{item.active ? 'Ativa' : 'Inativa'}</span>
                </li>
              ))}
            </ul>
          </Section>

          <RecipePresentationSection
            token={token}
            market={market}
            recipeKey={recipeKey}
            content={content}
            canWrite={canWrite}
            onSaved={setContent}
          />

          <RecipeLibraryImageSection
            kind="banner"
            token={token}
            market={market}
            recipeKey={recipeKey}
            content={content}
            canWrite={canWrite}
            onSaved={setContent}
          />

          <RecipeLibraryImageSection
            kind="plan"
            token={token}
            market={market}
            recipeKey={recipeKey}
            content={content}
            canWrite={canWrite}
            onSaved={setContent}
          />

          <Section
            title="Rótulo"
            description={`${labelLanguage}. Ingredientes, níveis de garantia, kcal/kg e kcal por embalagem completam o rótulo${market === 'US' ? ', com ao menos um aviso' : ''}.`}
            actions={<span className={labelBadge}>{LABEL_STATUS_TEXT[content.labelStatus]}</span>}
          >
            {labelNotice ? (
              <div className={labelNotice.tone === 'error' ? 'alert' : 'success'} role={labelNotice.tone === 'error' ? 'alert' : 'status'}>
                {labelNotice.text}
              </div>
            ) : null}
            {content.labelStatus === 'incomplete' && content.labelMissing.length ? (
              <p className="field-hint warning-text">Falta: {labelMissingText(content.labelMissing)}.</p>
            ) : null}
            <form className="label-form" onSubmit={(event) => void saveLabel(event)}>
              <div className="form-grid">
                {TEXT_FIELDS.map(({ field, label: text }) => (
                  <label key={field}>
                    {text}
                    <input value={label[field]} disabled={readOnlyLabel} onChange={(event) => updateLabel({ [field]: event.target.value })} />
                  </label>
                ))}
                <label className="label-form-wide">
                  Endereço do fabricante
                  <textarea
                    rows={2}
                    value={label.manufacturerLocation}
                    disabled={readOnlyLabel}
                    onChange={(event) => updateLabel({ manufacturerLocation: event.target.value })}
                  />
                </label>
              </div>

              <fieldset className="label-list">
                <legend>Níveis de garantia</legend>
                {label.analysis.length === 0 ? <p className="field-hint">Nenhuma linha.</p> : null}
                {label.analysis.map((row, index) => (
                  <div className="label-list-row label-analysis-row" key={index}>
                    <input
                      aria-label={`Nutriente ${index + 1}`}
                      placeholder="Proteína bruta (mín.)"
                      value={row.nutrient}
                      disabled={readOnlyLabel}
                      onChange={(event) => updateLabel({ analysis: label.analysis.map((current, at) => (at === index ? { ...current, nutrient: event.target.value } : current)) })}
                    />
                    <input
                      aria-label={`Valor ${index + 1}`}
                      placeholder="9,0%"
                      value={row.value}
                      disabled={readOnlyLabel}
                      onChange={(event) => updateLabel({ analysis: label.analysis.map((current, at) => (at === index ? { ...current, value: event.target.value } : current)) })}
                    />
                    {!readOnlyLabel ? (
                      <button
                        className="ghost-button"
                        type="button"
                        aria-label={`Remover nível de garantia ${index + 1}`}
                        onClick={() => updateLabel({ analysis: label.analysis.filter((_, at) => at !== index) })}
                      >
                        Remover
                      </button>
                    ) : null}
                  </div>
                ))}
                {!readOnlyLabel ? (
                  <button className="link-button" type="button" onClick={() => updateLabel({ analysis: [...label.analysis, { nutrient: '', value: '' }] })}>
                    Adicionar nível de garantia
                  </button>
                ) : null}
              </fieldset>

              {LIST_FIELDS.map(({ field, label: text, item, paragraphs, pasteable }) => (paragraphs ? (
                <ParagraphsEditor
                  key={field}
                  label={text}
                  values={label[field]}
                  disabled={readOnlyLabel}
                  onChange={(values) => updateLabel({ [field]: values })}
                />
              ) : (
                <ListEditor
                  key={field}
                  label={text}
                  item={item}
                  values={label[field]}
                  disabled={readOnlyLabel}
                  pasteable={pasteable}
                  onChange={(values) => updateLabel({ [field]: values })}
                />
              )))}

              {canWrite ? (
                <div className="inline-actions">
                  <button className="primary-button" type="submit" disabled={savingLabel}>
                    {savingLabel ? 'Salvando…' : 'Salvar rótulo'}
                  </button>
                </div>
              ) : null}
            </form>
          </Section>
        </div>
      ) : null}

      <Dialog
        open={renameOpen}
        title="Renomear receita"
        description={`A chave ${recipeKey} não muda.`}
        onClose={() => { if (!busy) setRenameOpen(false) }}
        footer={(
          <>
            <button className="ghost-button" type="button" onClick={() => setRenameOpen(false)} disabled={busy}>Cancelar</button>
            <button className="primary-button" type="button" onClick={() => void renameRecipe()} disabled={busy}>Salvar nome</button>
          </>
        )}
      >
        <form className="access-form" onSubmit={(event) => void renameRecipe(event)}>
          <div className="access-fields">
            <label className="access-field-wide">
              Nome
              <input aria-label="Nome da receita" value={renameValue} maxLength={120} onChange={(event) => setRenameValue(event.target.value)} />
            </label>
          </div>
        </form>
      </Dialog>
    </PageFrame>
  )
}
