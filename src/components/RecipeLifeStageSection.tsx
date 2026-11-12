import { useState } from 'react'
import { Section } from './Section'
import { apiRequest } from '../lib/api'
import {
  LIFE_STAGE_LABELS,
  recipeContentFailure,
  recipeContentPath,
  type LifeStage,
  type RecipeContent,
} from '../lib/recipeContent'

type Notice = { tone: 'success' | 'error'; text: string } | null

// Life stage of the recipe. Saving it rewrites the line of every linked variation; a pick that is not saved
// is not an unsaved change, it has its own button.
export function RecipeLifeStageSection({ token, market, recipeKey, content, canWrite, onSaved }: {
  token: string | null
  market: string
  recipeKey: string
  content: RecipeContent
  canWrite: boolean
  onSaved: (content: RecipeContent) => void
}) {
  const [lifeStage, setLifeStage] = useState<LifeStage>(content.lifeStage ?? 'adult')
  const [notice, setNotice] = useState<Notice>(null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!token || !canWrite || saving) return
    try {
      setSaving(true)
      const saved = await apiRequest<RecipeContent>(recipeContentPath(recipeKey, market), {
        token,
        method: 'PATCH',
        body: { lifeStage },
      })
      onSaved(saved)
      setNotice({ tone: 'success', text: `Fase salva: ${LIFE_STAGE_LABELS[saved.lifeStage]}.` })
    } catch (requestError) {
      setNotice({ tone: 'error', text: recipeContentFailure(requestError, 'Falha ao salvar a fase da receita.') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section
      id="fase"
      title="Fase da vida"
      description={`A receita é ${LIFE_STAGE_LABELS[content.lifeStage ?? 'adult'].toLowerCase()}. Todas as variações vinculadas seguem esta fase na loja, no plano e no cálculo nutricional.`}
    >
      {notice ? (
        <div className={notice.tone === 'error' ? 'alert' : 'success'} role={notice.tone === 'error' ? 'alert' : 'status'}>
          {notice.text}
        </div>
      ) : null}
      <div className="inline-actions">
        <select
          aria-label="Fase da vida"
          value={lifeStage}
          disabled={!canWrite || saving}
          onChange={(event) => { setLifeStage(event.target.value as LifeStage); setNotice(null) }}
        >
          {(Object.keys(LIFE_STAGE_LABELS) as LifeStage[]).map((stage) => (
            <option key={stage} value={stage}>{LIFE_STAGE_LABELS[stage]}</option>
          ))}
        </select>
        {canWrite ? (
          <button className="primary-button" type="button" onClick={() => void save()} disabled={saving || lifeStage === content.lifeStage}>
            Salvar fase
          </button>
        ) : null}
      </div>
    </Section>
  )
}
