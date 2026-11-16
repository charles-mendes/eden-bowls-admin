import { formatMinorAmount, type CustomerInvoice } from './customerInvoices'
import type { NfeSummary } from './nfe'
import type { PaidCycle } from './paidCycles'

// A Stripe invoice as POST /admin/billing/subscriptions/:id/sync-invoices returns it. `amountPaid` is Stripe's
// `amount_paid`, in minor units.
export type StripeInvoiceItem = {
  id: string
  number: string | null
  status: string
  amountPaid: number
  currency: string
  createdAt: string | null
}

// One charge of the subscription: everything the page knows about one Stripe invoice, side by side.
export type Charge = {
  key: string
  // Null only for an NF-e from an older API that does not say which invoice it bills.
  stripeInvoiceId: string | null
  // The day the row is about: the cycle's delivery, else its payment, else the documents' dates.
  date: string | null
  paid: boolean
  amount: string
  cycle: PaidCycle | null
  invoice: CustomerInvoice | null
  // Another Eden Bowls invoice for the same Stripe invoice, issued under another account. Kept visible, not hidden.
  otherInvoices: CustomerInvoice[]
  nfe: NfeSummary | null
  stripe: StripeInvoiceItem | null
}

type ChargeSources = {
  subscriptionAccount?: string | null
  paidCycles?: PaidCycle[]
  customerInvoices?: CustomerInvoice[]
  nfeItems?: NfeSummary[]
  stripeInvoices?: StripeInvoiceItem[]
}

type Draft = Omit<Charge, 'date' | 'paid' | 'amount' | 'invoice' | 'otherInvoices'> & { invoices: CustomerInvoice[] }

function newest<T>(items: T[], date: (item: T) => string | null | undefined): T | null {
  return [...items].sort((a, b) => String(date(b) || '').localeCompare(String(date(a) || '')))[0] ?? null
}

// The amount the row shows: the Eden Bowls total, else what Stripe says was paid, else nothing known.
export function chargeAmount(invoice: CustomerInvoice | null, stripe: StripeInvoiceItem | null): string {
  if (invoice) return formatMinorAmount(invoice.total_minor, invoice.currency)
  if (stripe && Number.isFinite(stripe.amountPaid)) return formatMinorAmount(stripe.amountPaid, stripe.currency)
  return '—'
}

// Joins what the page already loaded by Stripe invoice id, newest first. A source the reader cannot load is simply
// absent. Nothing here calls Stripe.
export function buildCharges(sources: ChargeSources): Charge[] {
  const drafts = new Map<string, Draft>()
  const nfeByInvoice = new Map<string, NfeSummary[]>()
  const loose: Charge[] = []

  const draft = (stripeInvoiceId: string) => {
    let row = drafts.get(stripeInvoiceId)
    if (!row) {
      row = { key: stripeInvoiceId, stripeInvoiceId, cycle: null, invoices: [], nfe: null, stripe: null }
      drafts.set(stripeInvoiceId, row)
    }
    return row
  }

  for (const cycle of sources.paidCycles ?? []) {
    const row = draft(cycle.invoice_id)
    if (!row.cycle) row.cycle = cycle
  }
  for (const invoice of sources.customerInvoices ?? []) {
    draft(invoice.stripe_invoice_id).invoices.push(invoice)
  }
  for (const stripe of sources.stripeInvoices ?? []) {
    draft(stripe.id).stripe = stripe
  }
  for (const nfe of sources.nfeItems ?? []) {
    if (nfe.stripe_invoice_id) {
      draft(nfe.stripe_invoice_id)
      nfeByInvoice.set(nfe.stripe_invoice_id, [...(nfeByInvoice.get(nfe.stripe_invoice_id) ?? []), nfe])
    } else {
      loose.push({
        key: `nfe-${nfe.id}`,
        stripeInvoiceId: null,
        date: nfe.created_at,
        paid: true,
        amount: formatMinorAmount(nfe.total_minor, nfe.currency),
        cycle: null,
        invoice: null,
        otherInvoices: [],
        nfe,
        stripe: null,
      })
    }
  }

  const account = String(sources.subscriptionAccount || '').toLowerCase()
  const rows: Charge[] = [...drafts.values()].map((row) => {
    const nfe = newest(nfeByInvoice.get(row.key) ?? [], (item) => item.created_at)
    const own = row.invoices.filter((item) => !account || String(item.stripe_account).toLowerCase() === account)
    const invoice = newest(own.length ? own : row.invoices, (item) => item.issued_at)
    const otherInvoices = row.invoices.filter((item) => item !== invoice)
    const date = row.cycle?.delivery_date || row.cycle?.paid_at || invoice?.issued_at || row.stripe?.createdAt || nfe?.created_at || null
    return {
      key: row.key,
      stripeInvoiceId: row.stripeInvoiceId,
      date,
      paid: Boolean(row.cycle) || row.stripe?.status === 'paid' || invoice?.invoice_status === 'paid',
      amount: chargeAmount(invoice, row.stripe),
      cycle: row.cycle,
      invoice,
      otherInvoices,
      nfe,
      stripe: row.stripe,
    }
  })

  return [...rows, ...loose].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
}
