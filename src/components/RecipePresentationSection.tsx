import { useState, type FormEvent } from 'react'
import { Section } from './Section'
import { ApiRequestError, apiRequest } from '../lib/api'
import {
  PRESENTATION_COLOR_FIELDS,
  PRESENTATION_LIMITS,
  recipeContentFailure,
  recipeContentPath,
  type PresentationColor,
  type RecipeContent,
  type RecipePresentation,
} from '../lib/recipeContent'

type Notice = { tone: 'success' | 'error'; text: string } | null

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/

function presentationForm(presentation: RecipePresentation | null | undefined): RecipePresentation {
  return {
    tag: presentation?.tag ?? '',
    title: presentation?.title ?? '',
    tagline: presentation?.tagline ?? '',
    resume: presentation?.resume ?? '',
    highlights: presentation?.highlights?.length ? [...presentation.highlights] : [''],
    colors: Object.fromEntries(
      PRESENTATION_COLOR_FIELDS.map(({ field }) => [field, presentation?.colors?.[field] ?? '']),
    ) as Record<PresentationColor, string>,
  }
}

// Store page of the recipe (title, tagline, resume, highlights and colors), in the market language and saved
// whole. The store has no other source, so activation waits for it.
export function RecipePresentationSection({ token, market, recipeKey, content, canWrite, onSaved }: {
  token: string | null
  market: string
  recipeKey: string
  content: RecipeContent
  canWrite: boolean
  onSaved: (content: RecipeContent) => void
}) {
  const [form, setForm] = useState(() => presentationForm(content.presentation))
  const [invalid, setInvalid] = useState<string[]>([])
  const [notice, setNotice] = useState<Notice>(null)
  const [saving, setSaving] = useState(false)
  const readOnly = !canWrite
  const language = market === 'US' ? 'Em inglês · US' : 'Em português · BR'

  const update = (patch: Partial<RecipePresentation>) => setForm((current) => ({ ...current, ...patch }))
  const updateColor = (field: PresentationColor, value: string) => update({ colors: { ...form.colors, [field]: value } })
  const isInvalid = (field: string) => invalid.includes(field)

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !canWrite || saving) return
    try {
      setSaving(true)
      const saved = await apiRequest<RecipeContent>(recipeContentPath(recipeKey, market, '/presentation'), {
        token,
        method: 'PUT',
        body: { presentation: { ...form, highlights: form.highlights.filter((item) => item.trim()) } },
      })
      onSaved(saved)
      setForm(presentationForm(saved.presentation))
      setInvalid([])
      setNotice({ tone: 'success', text: 'Apresentação salva. A loja passa a usar estes textos e cores.' })
    } catch (requestError) {
      const fields = requestError instanceof ApiRequestError && Array.isArray(requestError.details?.fields)
        ? requestError.details.fields as string[]
        : []
      setInvalid(fields)
      setNotice({ tone: 'error', text: recipeContentFailure(requestError, 'Falha ao salvar a apresentação.') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section
      title="Apresentação na loja"
      description={`${language}. Nome curto, título, chamada, resumo, destaques e cores da página da receita, do carrossel da tela inicial e do plano.`}
      actions={<span className={content.presentation ? 'badge-success' : 'badge-warning'}>{content.presentation ? 'Cadastrada' : 'Sem apresentação'}</span>}
    >
      {notice ? (
        <div className={notice.tone === 'error' ? 'alert' : 'success'} role={notice.tone === 'error' ? 'alert' : 'status'}>
          {notice.text}
        </div>
      ) : null}
      {!content.presentation ? (
        <p className="field-hint warning-text">Sem apresentação, as variações desta receita não podem ser ativadas.</p>
      ) : null}
      <form className="label-form" onSubmit={(event) => void save(event)}>
        <div className="form-grid">
          <label>
            Nome curto
            <input value={form.tag} maxLength={PRESENTATION_LIMITS.tag} disabled={readOnly} aria-invalid={isInvalid('tag') || undefined} aria-describedby="presentation-tag-hint" onChange={(event) => update({ tag: event.target.value })} />
            <span id="presentation-tag-hint" className="field-hint">Aba do carrossel e chip do plano, como “Carne” ou “Frango e Porco”.</span>
          </label>
          <label>
            Título
            <input value={form.title} maxLength={PRESENTATION_LIMITS.title} disabled={readOnly} aria-invalid={isInvalid('title') || undefined} onChange={(event) => update({ title: event.target.value })} />
          </label>
          <label>
            Chamada
            <input value={form.tagline} maxLength={PRESENTATION_LIMITS.tagline} disabled={readOnly} aria-invalid={isInvalid('tagline') || undefined} onChange={(event) => update({ tagline: event.target.value })} />
          </label>
          <label className="label-form-wide">
            Resumo
            <textarea rows={3} value={form.resume} maxLength={PRESENTATION_LIMITS.resume} disabled={readOnly} aria-invalid={isInvalid('resume') || undefined} onChange={(event) => update({ resume: event.target.value })} />
          </label>
        </div>

        <fieldset className="label-list">
          <legend>Destaques</legend>
          {form.highlights.map((value, index) => (
            <div className="label-list-row" key={index}>
              <input
                aria-label={`Destaque ${index + 1}`}
                value={value}
                maxLength={PRESENTATION_LIMITS.highlight}
                disabled={readOnly}
                aria-invalid={isInvalid(`highlights[${index}]`) || undefined}
                onChange={(event) => update({ highlights: form.highlights.map((current, at) => (at === index ? event.target.value : current)) })}
              />
              {!readOnly && form.highlights.length > 1 ? (
                <button className="ghost-button" type="button" aria-label={`Remover destaque ${index + 1}`} onClick={() => update({ highlights: form.highlights.filter((_, at) => at !== index) })}>
                  Remover
                </button>
              ) : null}
            </div>
          ))}
          {!readOnly && form.highlights.length < PRESENTATION_LIMITS.highlights ? (
            <button className="link-button" type="button" onClick={() => update({ highlights: [...form.highlights, ''] })}>
              Adicionar destaque
            </button>
          ) : null}
          <span className={isInvalid('highlights') ? 'field-hint warning-text' : 'field-hint'}>De 1 a {PRESENTATION_LIMITS.highlights} destaques, até {PRESENTATION_LIMITS.highlight} caracteres cada.</span>
        </fieldset>

        <fieldset className="label-list">
          <legend>Cores</legend>
          <div className="presentation-colors">
            {PRESENTATION_COLOR_FIELDS.map(({ field, label }) => (
              <div key={field} className="presentation-color">
                <label htmlFor={`presentation-${field}`}>{label}</label>
                <span className="presentation-color-input">
                  <input
                    type="color"
                    aria-hidden="true"
                    tabIndex={-1}
                    value={HEX_PATTERN.test(form.colors[field]) ? form.colors[field] : '#000000'}
                    disabled={readOnly}
                    onChange={(event) => updateColor(field, event.target.value.toUpperCase())}
                  />
                  <input
                    id={`presentation-${field}`}
                    className="mono"
                    value={form.colors[field]}
                    maxLength={7}
                    placeholder="#RRGGBB"
                    disabled={readOnly}
                    aria-invalid={isInvalid(`colors.${field}`) || undefined}
                    onChange={(event) => updateColor(field, event.target.value)}
                  />
                </span>
              </div>
            ))}
          </div>
        </fieldset>

        {canWrite ? (
          <div className="inline-actions">
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar apresentação'}
            </button>
          </div>
        ) : null}
      </form>
    </Section>
  )
}
