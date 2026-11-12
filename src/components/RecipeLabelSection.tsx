import { useEffect, useState, type FormEvent } from 'react'
import { ListEditor, ParagraphsEditor } from './RecipeListEditors'
import { Section } from './Section'
import { apiRequest } from '../lib/api'
import {
  LABEL_STATUS_TEXT,
  labelMissingText,
  recipeContentFailure,
  recipeContentPath,
  type RecipeContent,
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

// Label of the recipe in the market language. The form differing from the saved label is an unsaved change.
export function RecipeLabelSection({ token, market, recipeKey, content, canWrite, onSaved, onDirtyChange }: {
  token: string | null
  market: string
  recipeKey: string
  content: RecipeContent
  canWrite: boolean
  onSaved: (content: RecipeContent) => void
  onDirtyChange?: (dirty: boolean) => void
}) {
  const [label, setLabel] = useState<RecipeLabel>(() => labelForm(content.label))
  const [notice, setNotice] = useState<Notice>(null)
  const [saving, setSaving] = useState(false)
  const readOnly = !canWrite
  const dirty = canWrite && JSON.stringify(label) !== JSON.stringify(labelForm(content.label))

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const updateLabel = (patch: Partial<RecipeLabel>) => setLabel((current) => ({ ...current, ...patch }))

  const saveLabel = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !market || !canWrite || saving) return
    try {
      setSaving(true)
      const saved = await apiRequest<RecipeContent>(recipeContentPath(recipeKey, market, '/label'), {
        token,
        method: 'PUT',
        body: { label: labelPayload(label) },
      })
      onSaved(saved)
      setLabel(labelForm(saved.label))
      setNotice({
        tone: 'success',
        text: saved.labelStatus === 'complete' ? 'Rótulo salvo e completo.' : 'Rótulo salvo como rascunho.',
      })
    } catch (requestError) {
      setNotice({ tone: 'error', text: recipeContentFailure(requestError, 'Falha ao salvar o rótulo.') })
    } finally {
      setSaving(false)
    }
  }

  const labelBadge = content.labelStatus === 'complete'
    ? 'badge-success'
    : content.labelStatus === 'incomplete' ? 'badge-warning' : 'badge-neutral'
  const labelLanguage = market === 'US' ? 'Rótulo em inglês · US' : 'Rótulo em português · BR'

  return (
    <Section
      id="rotulo"
      title="Rótulo"
      description={`${labelLanguage}. Ingredientes, níveis de garantia, kcal/kg e kcal por embalagem completam o rótulo${market === 'US' ? ', com ao menos um aviso' : ''}.`}
      actions={<span className={labelBadge}>{LABEL_STATUS_TEXT[content.labelStatus]}</span>}
    >
      {notice ? (
        <div className={notice.tone === 'error' ? 'alert' : 'success'} role={notice.tone === 'error' ? 'alert' : 'status'}>
          {notice.text}
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
              <input value={label[field]} disabled={readOnly} onChange={(event) => updateLabel({ [field]: event.target.value })} />
            </label>
          ))}
          <label className="label-form-wide">
            Endereço do fabricante
            <textarea
              rows={2}
              value={label.manufacturerLocation}
              disabled={readOnly}
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
                disabled={readOnly}
                onChange={(event) => updateLabel({ analysis: label.analysis.map((current, at) => (at === index ? { ...current, nutrient: event.target.value } : current)) })}
              />
              <input
                aria-label={`Valor ${index + 1}`}
                placeholder="9,0%"
                value={row.value}
                disabled={readOnly}
                onChange={(event) => updateLabel({ analysis: label.analysis.map((current, at) => (at === index ? { ...current, value: event.target.value } : current)) })}
              />
              {!readOnly ? (
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
          {!readOnly ? (
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
            disabled={readOnly}
            onChange={(values) => updateLabel({ [field]: values })}
          />
        ) : (
          <ListEditor
            key={field}
            label={text}
            item={item}
            values={label[field]}
            disabled={readOnly}
            pasteable={pasteable}
            onChange={(values) => updateLabel({ [field]: values })}
          />
        )))}

        {canWrite ? (
          <div className="inline-actions">
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar rótulo'}
            </button>
          </div>
        ) : null}
      </form>
    </Section>
  )
}
