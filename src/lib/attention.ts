import { issueCodeText, type AddressIssue } from './addressIssues'
import type { CourierDelivery } from './courierDeliveries'
import { alertPresentation } from './customerSubscriptions'
import { blingProblemGuide, missingFieldLabel, NFE_NEEDS_ACTION_STATUSES, type NfeSummary } from './nfe'

// One open problem of the subscription, in plain words, with what to do and where.
export type AttentionEntry = {
  key: string
  title: string
  details: string[]
  next: string
  href: string | null
  linkLabel: string
}

export const ADDRESS_SECTION_ID = 'problema-endereco'
export const COURIER_SECTION_ID = 'entrega-brasil'

type Sources = {
  subscriptionId: string
  stripeAccount?: string | null
  nfeItems?: NfeSummary[]
  addressIssue?: AddressIssue | null
  // What the courier dispatch would refuse; only counts while a paid cycle waits to leave.
  courierIssues?: string[] | null
  courierWaiting?: boolean
  courierItems?: CourierDelivery[]
  marketException?: boolean
}

// The newest note of each invoice: an older refused note that a later one replaced is not a problem any more.
function latestNotes(items: NfeSummary[]) {
  const byInvoice = new Map<string, NfeSummary>()
  for (const item of items) {
    const key = item.stripe_invoice_id || `nfe-${item.id}`
    const kept = byInvoice.get(key)
    if (!kept || String(item.created_at || '') > String(kept.created_at || '')) byInvoice.set(key, item)
  }
  return [...byInvoice.values()]
}

function nfeEntry(item: NfeSummary, sources: Sources): AttentionEntry {
  const presented = alertPresentation(
    { code: 'nfe_problem', nfeId: item.id, status: item.status, lastError: item.last_error },
    { id: sources.subscriptionId, stripeAccount: sources.stripeAccount ?? '' },
  )
  const base = { key: `nfe-${item.id}`, title: presented.text, href: `/operations/nfe/${item.id}`, linkLabel: 'Abrir a nota' }
  const missing = item.missing_fields ?? []
  if (missing.length) {
    return {
      ...base,
      details: [`Falta para emitir: ${missing.map(missingFieldLabel).join(', ')}.`],
      next: 'O cliente corrige na loja, em Meu plano → Editar assinatura, e a nota volta para a fila sozinha. "Corrigir dados" na nota fica para exceções.',
    }
  }
  const problems = item.bling_problems ?? []
  if (problems.length) {
    const guides = problems.map(blingProblemGuide)
    return {
      ...base,
      details: problems.map((problem, index) => `${problem.message} (${guides[index].where})`),
      next: guides[0].how,
    }
  }
  return {
    ...base,
    details: item.last_error ? [item.last_error] : [],
    next: 'Abra a nota para ver o que falta e use Nova tentativa depois de corrigir.',
  }
}

// The problems the page lists above the sections. Nothing open, nothing listed.
export function attentionEntries(sources: Sources): AttentionEntry[] {
  const entries: AttentionEntry[] = []

  if (sources.marketException) {
    entries.push({
      key: 'market-exception',
      title: 'Conta e país do endereço não combinam',
      details: ['Esta assinatura não sai pela fila de etiquetas nem pela de entregas e não recebe NF-e até a conta e o país do endereço combinarem.'],
      next: 'Resolva em Exceções de mercado.',
      href: '/operations/market-exceptions',
      linkLabel: 'Abrir Exceções de mercado',
    })
  }

  for (const item of latestNotes(sources.nfeItems ?? [])) {
    if (NFE_NEEDS_ACTION_STATUSES.includes(item.status)) entries.push(nfeEntry(item, sources))
  }

  const issue = sources.addressIssue?.open ? sources.addressIssue : null
  if (issue) {
    entries.push({
      key: 'address-issue',
      title: 'Problema de endereço',
      details: issue.codes.map(issueCodeText),
      next: 'O cliente corrige em Meu plano → Editar assinatura, na loja. Fale com ele pelo contato da seção.',
      href: `#${ADDRESS_SECTION_ID}`,
      linkLabel: 'Ver o problema de endereço',
    })
  }

  // The address problem above already names its codes; the lock lists only what it adds.
  const lock = (sources.courierWaiting ? sources.courierIssues ?? [] : []).filter((code) => !issue?.codes.includes(code))
  if (lock.length) {
    entries.push({
      key: 'courier-lock',
      title: 'Despacho travado',
      details: lock.map(issueCodeText),
      next: lock.includes('recipient_name_missing')
        ? 'Use "Informar quem recebe" na entrega Brasil. O resto do endereço o cliente corrige na loja.'
        : 'O cliente corrige o endereço na loja, em Meu plano → Editar assinatura.',
      href: `#${COURIER_SECTION_ID}`,
      linkLabel: 'Ir para a entrega Brasil',
    })
  }

  const items = sources.courierItems ?? []
  const leftAgain = new Set(items.filter((item) => item.status === 'out_for_delivery' || item.status === 'delivered').map((item) => item.stripe_invoice_id))
  const failed = items.filter((item) => item.status === 'failed' && !leftAgain.has(item.stripe_invoice_id))
  const failedInvoices = new Set<string>()
  for (const item of failed) {
    if (failedInvoices.has(item.stripe_invoice_id)) continue
    failedInvoices.add(item.stripe_invoice_id)
    entries.push({
      key: `courier-failed-${item.id}`,
      title: 'Entrega falhou',
      details: item.failure_reason ? [item.failure_reason] : [],
      next: 'Combine com o cliente e despache de novo.',
      href: `#${COURIER_SECTION_ID}`,
      linkLabel: 'Ir para a entrega Brasil',
    })
  }

  return entries
}
