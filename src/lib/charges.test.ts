import { buildCharges, chargeAmount, type StripeInvoiceItem } from './charges'
import type { CustomerInvoice } from './customerInvoices'
import type { NfeSummary } from './nfe'
import type { PaidCycle } from './paidCycles'

function cycle(overrides: Partial<PaidCycle> = {}): PaidCycle {
  return {
    invoice_id: 'in_nov',
    preparation_day: '2026-11-02',
    production_status: 'ready',
    delivery_date: '2026-11-03',
    paid_at: '2026-11-02T22:37:00Z',
    ups_shipment: null,
    courier_delivery: null,
    ...overrides,
  }
}

function invoice(overrides: Partial<CustomerInvoice> = {}): CustomerInvoice {
  return {
    id: 10,
    invoice_number: 'EB-2026-000010',
    stripe_invoice_id: 'in_nov',
    stripe_account: 'br',
    locale: 'pt-BR',
    currency: 'brl',
    total_minor: 132997,
    amount_paid_minor: 132997,
    invoice_status: 'paid',
    billing_reason: 'subscription_create',
    issued_at: '2026-11-02T22:37:15Z',
    pdf_available: true,
    pdf_generated_at: '2026-11-02T22:37:15Z',
    email_to: 'ana@example.com',
    email_status: 'sent',
    email_sent_at: '2026-11-02T22:37:15Z',
    email_attempts: 1,
    email_last_error: null,
    email_next_attempt_at: null,
    ...overrides,
  }
}

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
    last_error: 'Não foi possível emitir a nota fiscal',
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

function stripe(overrides: Partial<StripeInvoiceItem> = {}): StripeInvoiceItem {
  return { id: 'in_nov', number: 'ABC-0001', status: 'paid', amountPaid: 132997, currency: 'brl', createdAt: '2026-11-02T22:37:00Z', ...overrides }
}

describe('buildCharges', () => {
  test('puts the cycle, the Eden Bowls invoice and the NF-e of one Stripe invoice in one row', () => {
    const rows = buildCharges({ subscriptionAccount: 'br', paidCycles: [cycle()], customerInvoices: [invoice()], nfeItems: [nfe()] })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      stripeInvoiceId: 'in_nov',
      date: '2026-11-03',
      paid: true,
      invoice: { invoice_number: 'EB-2026-000010' },
      nfe: { id: 2 },
      otherInvoices: [],
    })
    expect(rows[0].amount).toBe(chargeAmount(invoice(), null))
  })

  test('a paid cycle without an Eden Bowls invoice still gets a paid row, with no amount known', () => {
    const [row] = buildCharges({ paidCycles: [cycle()] })

    expect(row).toMatchObject({ paid: true, invoice: null, amount: '—' })
  })

  test('an NF-e alone makes its own row, and one without an invoice id is not lost', () => {
    const rows = buildCharges({ nfeItems: [nfe(), nfe({ id: 3, stripe_invoice_id: undefined, created_at: '2026-10-01T10:00:00Z' })] })

    expect(rows.map((row) => row.key)).toEqual(['in_nov', 'nfe-3'])
    expect(rows[1]).toMatchObject({ stripeInvoiceId: null, nfe: { id: 3 } })
  })

  test('a source the reader cannot load just adds nothing', () => {
    const rows = buildCharges({ customerInvoices: [invoice()] })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ cycle: null, nfe: null, stripe: null, paid: true })
  })

  test('shows the Stripe amount converted from minor units when there is no Eden Bowls invoice', () => {
    const [row] = buildCharges({ stripeInvoices: [stripe()] })

    expect(row.amount).toBe(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(1329.97))
  })

  test('keeps the invoice of the subscription account and names the other one', () => {
    const us = invoice({ id: 11, invoice_number: 'EB-2026-000011', stripe_account: 'us', locale: 'en-US' })
    const [row] = buildCharges({ subscriptionAccount: 'br', customerInvoices: [us, invoice()] })

    expect(row.invoice?.invoice_number).toBe('EB-2026-000010')
    expect(row.otherInvoices.map((item) => item.invoice_number)).toEqual(['EB-2026-000011'])
  })

  test('merges fetched Stripe invoices into the existing rows without duplicates, newest first', () => {
    const rows = buildCharges({
      paidCycles: [cycle()],
      customerInvoices: [invoice()],
      stripeInvoices: [stripe(), stripe({ id: 'in_old', status: 'open', amountPaid: 0, createdAt: '2026-10-02T10:00:00Z' })],
    })

    expect(rows.map((row) => row.key)).toEqual(['in_nov', 'in_old'])
    expect(rows[0].stripe?.number).toBe('ABC-0001')
    expect(rows[1]).toMatchObject({ paid: false, invoice: null })
  })
})
