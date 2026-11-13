import type { RecipeLabelStatus } from '../lib/recipeContent'

// What a product still needs before it shows in the store. It mirrors the API: a variation only activates with
// price, Stripe price, store photo, presentation, NCM (BR) and label (US); the store lists a product with an active
// variation; the product itself must be published.

export type ReadinessGroup = 'Conteúdo da receita' | 'Variações' | 'Publicação'

export type ReadinessTarget = 'imagens' | 'apresentacao' | 'rotulo' | 'variacoes' | 'publicar'

export type ReadinessStep = {
  id: string
  group: ReadinessGroup
  title: string
  done: boolean
  // What is missing, in words the operator acts on.
  detail?: string
  target?: ReadinessTarget
}

export type ReadinessVariation = {
  label: string
  active: boolean
  // Variation-level gaps only (preço, NCM); the Stripe price is created on activation, content gaps come from the content.
  missing: string[]
  finalImageReady: boolean
  labelDataReady: boolean
}

export type ReadinessInput = {
  published: boolean
  planCountry: string
  content: { imageUrl: string | null; presentationReady: boolean; labelStatus: RecipeLabelStatus; labelMissing: string[] } | null
  variations: ReadinessVariation[]
}

const LABEL_FIELD_TEXT: Record<string, string> = {
  ingredients: 'ingredientes',
  analysis: 'níveis de garantia',
  energyKg: 'energia por kg',
  energyPackage: 'energia por pacote',
  notices: 'avisos',
}

function list(items: string[]) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`
}

export function productReadinessSteps({ published, planCountry, content, variations }: ReadinessInput): ReadinessStep[] {
  const steps: ReadinessStep[] = []
  const pendingVariations = variations.filter((variation) => !variation.active)
  const allConfirmed = (flag: 'finalImageReady' | 'labelDataReady') => pendingVariations.length > 0 && pendingVariations.every((variation) => variation[flag])

  steps.push({
    id: 'image',
    group: 'Conteúdo da receita',
    title: 'Foto da receita na loja',
    done: Boolean(content?.imageUrl) || allConfirmed('finalImageReady'),
    detail: 'Envie a foto na aba Imagens.',
    target: 'imagens',
  })
  steps.push({
    id: 'presentation',
    group: 'Conteúdo da receita',
    title: 'Apresentação da receita',
    done: Boolean(content?.presentationReady),
    detail: 'Preencha e salve a aba Apresentação.',
    target: 'apresentacao',
  })
  if (planCountry === 'US') {
    const missing = (content?.labelMissing ?? []).map((field) => LABEL_FIELD_TEXT[field] ?? field)
    steps.push({
      id: 'label',
      group: 'Conteúdo da receita',
      title: 'Rótulo completo',
      done: content?.labelStatus === 'complete' || allConfirmed('labelDataReady'),
      detail: missing.length ? `Falta no rótulo: ${list(missing)}.` : 'Preencha o rótulo na aba Rótulo.',
      target: 'rotulo',
    })
  }

  steps.push({
    id: 'variation',
    group: 'Variações',
    title: 'Ao menos uma variação (tamanho de pack)',
    done: variations.length > 0,
    detail: 'Use Adicionar variação na aba Variações.',
    target: 'variacoes',
  })
  const incomplete = pendingVariations.filter((variation) => variation.missing.length > 0)
  if (variations.length > 0 && !variations.some((variation) => variation.active)) {
    steps.push({
      id: 'variation-data',
      group: 'Variações',
      title: 'Dados da variação',
      done: incomplete.length < pendingVariations.length,
      detail: incomplete.map((variation) => `${variation.label}: falta ${list(variation.missing)}`).join('; ') + '.',
      target: 'variacoes',
    })
  }
  steps.push({
    id: 'variation-active',
    group: 'Variações',
    title: 'Ao menos uma variação ativa',
    done: variations.some((variation) => variation.active),
    detail: 'Na aba Variações, use Ativar na variação pronta.',
    target: 'variacoes',
  })

  steps.push({
    id: 'published',
    group: 'Publicação',
    title: 'Produto publicado',
    done: published,
    detail: 'Use Publicar em Publicação e sincronização.',
    target: 'publicar',
  })
  return steps
}

const TARGET_TEXT: Record<ReadinessTarget, string> = {
  imagens: 'Abrir Imagens',
  apresentacao: 'Abrir Apresentação',
  rotulo: 'Abrir Rótulo',
  variacoes: 'Abrir Variações',
  publicar: 'Publicar',
}

export function ProductReadiness({ steps, onOpen, canPublish }: {
  steps: ReadinessStep[]
  onOpen: (target: ReadinessTarget) => void
  canPublish: boolean
}) {
  const doneCount = steps.filter((step) => step.done).length
  const ready = doneCount === steps.length
  const nextId = steps.find((step) => !step.done)?.id
  const groups = [...new Set(steps.map((step) => step.group))]

  return (
    <section className="section-card readiness-card" aria-labelledby="readiness-title">
      <div className="section-head">
        <div>
          <h3 id="readiness-title">{ready ? 'Produto na loja' : 'O que falta para aparecer na loja'}</h3>
          <p className="muted">
            {ready
              ? 'Tudo pronto: o produto está publicado e tem variação ativa.'
              : 'Resolva os itens na ordem. A variação só ativa com o conteúdo pronto, e a loja só mostra produto publicado com variação ativa.'}
          </p>
        </div>
        <span className={ready ? 'badge-success' : 'badge-warning'}>{doneCount} de {steps.length}</span>
      </div>
      <div
        className="readiness-bar"
        role="progressbar"
        aria-label="Itens concluídos"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={doneCount}
      >
        <span style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      {ready ? null : groups.map((group) => (
        <div key={group} className="readiness-group">
          <h4>{group}</h4>
          <ul className="readiness-list">
            {steps.filter((step) => step.group === group).map((step) => {
              const showAction = !step.done && step.target && (step.target !== 'publicar' || canPublish)
              return (
                <li key={step.id} className={step.done ? 'readiness-item done' : step.id === nextId ? 'readiness-item next' : 'readiness-item'}>
                  <span className="readiness-mark" aria-hidden="true">{step.done ? '✓' : ''}</span>
                  <div className="readiness-text">
                    <span className="readiness-title">
                      {step.title}
                      <span className="sr-only">{step.done ? ' (concluído)' : ' (pendente)'}</span>
                      {step.id === nextId ? <span className="badge-info readiness-next">Próximo passo</span> : null}
                    </span>
                    {step.done ? null : <span className="readiness-detail">{step.detail}</span>}
                  </div>
                  {showAction ? (
                    <button
                      className={step.id === nextId ? 'primary-button readiness-action' : 'ghost-button readiness-action'}
                      type="button"
                      aria-label={`${TARGET_TEXT[step.target!]} (${step.title})`}
                      onClick={() => onOpen(step.target!)}
                    >
                      {TARGET_TEXT[step.target!]}
                    </button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}
