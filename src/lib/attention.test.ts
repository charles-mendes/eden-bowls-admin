import { attentionEntries } from './attention'
import type { AddressIssue } from './addressIssues'
import type { CourierDelivery } from './courierDeliveries'
import type { NfeSummary } from './nfe'

function nfe(overrides: Partial<NfeSummary> = {}): NfeSummary {
  return {
    id: 2,
    status: 'error',
    customer_name: 'Ana',
    customer_email: 'ana@example.com',
    customer_document: null,
    total_minor: 132997,
    currency: 'brl',
    nfe_number: null,
    nfe_series: null,
    access_key: null,
    last_error: 'Não foi possível emitir a nota fiscal · Verifique as informações e tente novamente.',
    attempts: 1,
    created_at: '2026-11-02T22:37:15Z',
    authorized_at: null,
    bling_situacao: null,
    bling_situacao_label: null,
    imported: false,
    can_retry: true,
    can_edit: true,
    stripe_invoice_id: 'in_nov',
    ...overrides,
  }
}

function issue(overrides: Partial<AddressIssue> = {}): AddressIssue {
  return {
    id: 1,
    codes: ['address_number_missing'],
    source: 'courier_check',
    open: true,
    opened_at: '2026-11-02T10:00:00Z',
    email_sent_at: null,
    resolved_at: null,
    resolved_by: null,
    ...overrides,
  }
}

function courier(overrides: Partial<CourierDelivery> = {}): CourierDelivery {
  return {
    id: 1,
    subscription_id: '12',
    stripe_invoice_id: 'in_nov',
    method: 'uber',
    courier_name: null,
    tracking_url: null,
    cost_minor: 1000,
    currency: 'brl',
    note: null,
    status: 'failed',
    out_for_delivery_at: '2026-11-03T10:00:00Z',
    delivered_at: null,
    failed_at: '2026-11-03T12:00:00Z',
    failure_reason: 'Ninguém em casa',
    canceled_at: null,
    ...overrides,
  } as CourierDelivery
}

const base = { subscriptionId: '12', stripeAccount: 'br' }

describe('attentionEntries', () => {
  test('a note blocked for a missing fiscal name says what is missing, who fixes it, and links to the note', () => {
    const [entry] = attentionEntries({ ...base, nfeItems: [nfe({ status: 'blocked_missing_document', missing_fields: ['fiscal_name'] })] })

    expect(entry.details).toEqual(['Falta para emitir: Nome fiscal.'])
    expect(entry.next).toContain('Meu plano → Editar assinatura')
    expect(entry.href).toBe('/operations/nfe/2')
  })

  test('a note Bling refused lists the fields Bling named instead of the generic message', () => {
    const [entry] = attentionEntries({
      ...base,
      nfeItems: [nfe({ bling_problems: [{ element: 'itens[0].ncm', message: 'Informe o NCM' }] })],
    })

    expect(entry.title).toBe('NF-e com erro')
    expect(entry.details).toEqual(['Informe o NCM (Cadastro do produto no Bling)'])
    expect(entry.details.join(' ')).not.toContain('Não foi possível emitir')
    expect(entry.next).toContain('Cadastros → Produtos')
  })

  test('an older API without the new fields falls back to the last error', () => {
    const [entry] = attentionEntries({ ...base, nfeItems: [nfe({ stripe_invoice_id: undefined })] })

    expect(entry.details).toEqual([nfe().last_error])
    expect(entry.href).toBe('/operations/nfe/2')
  })

  test('a refused note that a newer authorized one replaced is not listed', () => {
    const entries = attentionEntries({
      ...base,
      nfeItems: [nfe(), nfe({ id: 3, status: 'authorized', created_at: '2026-11-04T10:00:00Z' })],
    })

    expect(entries).toEqual([])
  })

  test('an open address problem links to its section', () => {
    const [entry] = attentionEntries({ ...base, addressIssue: issue() })

    expect(entry).toMatchObject({ title: 'Problema de endereço', details: ['Falta o número'], href: '#problema-endereco' })
  })

  test('an address problem resolved recently is not listed', () => {
    expect(attentionEntries({ ...base, addressIssue: issue({ open: false, resolved_at: '2026-11-05T10:00:00Z' }) })).toEqual([])
  })

  test('the courier lock counts only while a cycle waits, and does not repeat the address problem', () => {
    expect(attentionEntries({ ...base, courierIssues: ['recipient_name_missing'], courierWaiting: false })).toEqual([])

    const entries = attentionEntries({
      ...base,
      addressIssue: issue(),
      courierIssues: ['address_number_missing', 'recipient_name_missing'],
      courierWaiting: true,
    })
    const lock = entries.find((entry) => entry.key === 'courier-lock')
    expect(lock?.details).toEqual(['Falta o nome de quem recebe'])
    expect(lock?.next).toContain('Informar quem recebe')
  })

  test('a failed delivery is listed until the box leaves again', () => {
    const [entry] = attentionEntries({ ...base, courierItems: [courier()] })
    expect(entry).toMatchObject({ title: 'Entrega falhou', details: ['Ninguém em casa'], href: '#entrega-brasil' })

    expect(attentionEntries({ ...base, courierItems: [courier(), courier({ id: 2, status: 'out_for_delivery', failed_at: null })] })).toEqual([])
  })

  test('the market exception is one entry linking to market exceptions', () => {
    const entries = attentionEntries({ ...base, marketException: true })

    expect(entries).toHaveLength(1)
    expect(entries[0].href).toBe('/operations/market-exceptions')
  })

  test('nothing open, nothing listed', () => {
    expect(attentionEntries({ ...base, nfeItems: [nfe({ status: 'authorized' })], addressIssue: null, courierItems: [] })).toEqual([])
  })
})
