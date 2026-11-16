import type { RecipeLabelStatus } from './recipeContent'

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
    detail: 'Use Publicar no topo da página.',
    target: 'publicar',
  })
  return steps
}
