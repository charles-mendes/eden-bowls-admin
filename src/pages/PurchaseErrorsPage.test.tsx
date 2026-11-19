import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PurchaseErrorsPage } from './PurchaseErrorsPage'
import { adminUser, readonlyUser } from '../test/fixtures'
import { checkMockedCall } from '../test/apiContract'
import type { AdminUser } from '../contexts/AuthContext'

const auth = vi.hoisted(() => ({ user: null as AdminUser | null }))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ token: 'access-token', user: auth.user }) }))

const step = (overrides: Record<string, unknown>) => ({
  id: 1, area: 'checkout', step: 'zipcode_lookup', action: null, outcome: 'failed', pet_id: null, subscription_id: null, stripe_event_id: null, stripe_event_type: null,
  http_status: 422, error_code: 'invalid_zipcode', error_message: 'CEP inválido.', stripe_code: null, stripe_type: null, stripe_param: null, created_at: '2026-11-18T12:00:00Z', ...overrides,
})

const rows = {
  br: [{
    kind: 'attempt', occurred_at: '2026-11-18T12:00:00Z', market: 'br', user_id: 5, email: 'ana@example.com', area: 'checkout', step: 'zipcode_lookup', action: null,
    attempt_status: 'paid', stripe_event_type: null, http_status: 422, error_code: 'invalid_zipcode', error_message: 'CEP inválido.', stripe_code: null, stripe_type: null, stripe_param: null,
    attempt: { id: 1 }, events: [step({}), step({ id: 2, step: 'payment_intent_ack', outcome: 'ok', http_status: 200, error_code: null, error_message: null })],
  }],
  us: [{
    kind: 'webhook', occurred_at: '2026-11-18T10:00:00Z', market: 'us', user_id: null, email: null, area: 'webhook', step: 'customer_not_resolved', action: null,
    attempt_status: null, stripe_event_type: 'invoice.payment_failed', http_status: null, error_code: 'customer_not_resolved', error_message: null, stripe_code: null, stripe_type: null, stripe_param: null,
    attempt: null, events: [],
  }, {
    kind: 'attempt', occurred_at: '2026-11-17T10:00:00Z', market: 'us', user_id: 9, email: 'bo@example.com', area: 'plan', step: 'plan_selection', action: null,
    attempt_status: 'failed', stripe_event_type: null, http_status: 422, error_code: 'recipe_life_stage_mismatch', error_message: 'Life stage.', stripe_code: null, stripe_type: null, stripe_param: null,
    attempt: { id: 2 }, events: [step({ id: 3, step: 'plan_selection', error_code: 'recipe_life_stage_mismatch' })],
  }],
}

function stubFetch() {
  const calls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost')
    calls.push(`${url.pathname}${url.search}`)
    checkMockedCall('GET', url.pathname)
    const market = (url.searchParams.get('market') || 'br') as 'br' | 'us'
    const body = url.pathname.endsWith('/config-events')
      ? { success: true, data: { market, events: market === 'br' ? [{ id: 7, action: 'shipping_settings.update', target_ref: 'br', outcome: 'failed', error_code: 'invalid_fee', actor_admin_id: 3, created_at: '2026-11-16T12:00:00Z' }] : [] } }
      : { success: true, data: { market, rows: rows[market], next_before: null } }
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))
  return calls
}

function renderPage(user: AdminUser) {
  auth.user = user
  return render(<MemoryRouter><PurchaseErrorsPage /></MemoryRouter>)
}

// purchase-error-monitor
describe('PurchaseErrorsPage', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('lists one market, shows the outcome next to the failed step, and links to the customer trail in that market', async () => {
    const user = userEvent.setup()
    const calls = stubFetch()
    renderPage(adminUser)

    // Brasil: dd/mm/aaaa.
    expect(screen.getByLabelText('De')).toHaveAttribute('placeholder', 'dd/mm/aaaa')
    const brFrom = (screen.getByLabelText('De') as HTMLInputElement).value
    expect(brFrom).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
    const item = (await screen.findAllByText('zipcode_lookup'))[0].closest('details') as HTMLElement
    expect(within(item).getByText('Pago')).toBeInTheDocument()
    expect(within(item).getByRole('link', { name: 'ana@example.com' })).toHaveAttribute('href', '/users/5?aba=trilha&mercado=BR')
    expect(calls.find((call) => call.startsWith('/api/v1/admin/purchase-trail/errors'))).toContain('market=br')
    expect(calls.find((call) => call.startsWith('/api/v1/admin/purchase-trail/config-events'))).toMatch(/market=br&outcome=failed&from=/)
    expect(screen.getByRole('table', { name: 'Configuração com falha' })).toHaveTextContent('invalid_fee')

    const before = calls.length
    await user.click(item.querySelector('summary') as HTMLElement)
    expect(within(item).getByRole('table', { name: 'Passos da tentativa' })).toHaveTextContent('payment_intent_ack')
    expect(calls.length).toBe(before)

    await user.click(within(screen.getByRole('group', { name: 'Mercado' })).getByRole('button', { name: 'Estados Unidos' }))
    expect(await screen.findByText('cliente não resolvido')).toBeInTheDocument()
    // United States: the same day as mm/dd/yyyy.
    const [day, month, year] = brFrom.split('/')
    expect(screen.getByLabelText('De')).toHaveValue(`${month}/${day}/${year}`)
    expect(screen.getByLabelText('De')).toHaveAttribute('placeholder', 'mm/dd/yyyy')
    expect(screen.queryAllByText('zipcode_lookup')).toHaveLength(0)
    expect(screen.getByRole('link', { name: 'bo@example.com' })).toHaveAttribute('href', '/users/9?aba=trilha&mercado=US')
    expect(calls.some((call) => call.startsWith('/api/v1/admin/purchase-trail/errors') && call.includes('market=us'))).toBe(true)
  })

  it('sends area and error code as filters, and has no write, replay or export control', async () => {
    const user = userEvent.setup()
    const calls = stubFetch()
    renderPage(readonlyUser)
    await screen.findAllByText('zipcode_lookup')
    expect(screen.queryByRole('group', { name: 'Mercado' })).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Área'), 'webhook')
    await user.type(screen.getByLabelText('Código de erro'), 'invalid_zipcode{Enter}')
    await waitFor(() => expect(calls.some((call) => call.includes('area=webhook') && call.includes('error_code=invalid_zipcode'))).toBe(true))
    // Only the refresh and the two calendar toggles: no write, replay or export.
    const buttons = screen.getAllByRole('button').map((button) => button.textContent || button.getAttribute('aria-label'))
    expect(buttons).toEqual(['Atualizar', 'Abrir calendário', 'Abrir calendário'])
  })
})
