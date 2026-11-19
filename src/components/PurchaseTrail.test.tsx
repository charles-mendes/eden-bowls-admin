import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PurchaseTrail } from './PurchaseTrail'
import { adminUser, readonlyUser } from '../test/fixtures'
import { checkMockedCall } from '../test/apiContract'

const attempts = {
  br: [{
    id: 1, market: 'br', area: 'checkout', status: 'failed', final_step: 'subscription_checkout', attempt_id: 'att_br',
    term_months: 3, currency: 'BRL', promotion_code_id: null, subscription_id: null, stripe_account: 'br',
    http_status: 502, error_code: 'stripe_subscription_failed', error_message: 'Cartão recusado.', stripe_code: 'card_declined', stripe_type: 'card_error', stripe_param: null,
    started_at: '2026-11-18T12:00:00Z', finished_at: '2026-11-18T12:05:00Z',
    events: [
      { id: 10, area: 'checkout', step: 'zipcode_lookup', action: null, outcome: 'failed', pet_id: null, subscription_id: null, stripe_event_id: null, stripe_event_type: null, http_status: 422, error_code: 'invalid_zipcode', error_message: 'CEP inválido.', stripe_code: null, stripe_type: null, stripe_param: null, created_at: '2026-11-18T12:01:00Z' },
      { id: 11, area: 'checkout', step: 'subscription_checkout', action: null, outcome: 'failed', pet_id: null, subscription_id: null, stripe_event_id: null, stripe_event_type: null, http_status: 502, error_code: 'stripe_subscription_failed', error_message: 'Cartão recusado.', stripe_code: 'card_declined', stripe_type: 'card_error', stripe_param: null, created_at: '2026-11-18T12:05:00Z' },
    ],
  }],
  us: [{
    id: 2, market: 'us', area: 'plan', status: 'in_progress', final_step: null, attempt_id: null,
    term_months: 1, currency: 'USD', promotion_code_id: null, subscription_id: null, stripe_account: null,
    http_status: null, error_code: null, error_message: null, stripe_code: null, stripe_type: null, stripe_param: null,
    started_at: '2026-11-17T12:00:00Z', finished_at: null,
    events: [{ id: 20, area: 'plan', step: 'plan_selection', action: null, outcome: 'failed', pet_id: null, subscription_id: null, stripe_event_id: null, stripe_event_type: null, http_status: 422, error_code: 'recipe_life_stage_mismatch', error_message: 'Life stage.', stripe_code: null, stripe_type: null, stripe_param: null, created_at: '2026-11-17T12:00:00Z' }],
  }],
}

function stubFetch() {
  const calls: string[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost')
    calls.push(`${url.pathname}${url.search}`)
    checkMockedCall('GET', url.pathname)
    const market = (url.searchParams.get('market') || 'br') as 'br' | 'us'
    const body = url.pathname.endsWith('/config-events')
      ? { success: true, data: { market, events: market === 'us' ? [{ id: 5, action: 'first_purchase_coupon.create', target_ref: 'term_3', outcome: 'ok', error_code: null, actor_admin_id: 7, created_at: '2026-11-16T12:00:00Z' }] : [] } }
      : { success: true, data: { market, attempts: attempts[market], unlinked_events: [] } }
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
  vi.stubGlobal('fetch', fetchMock)
  return calls
}

// customer-purchase-trail
describe('PurchaseTrail', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows one market at a time, with the step, the error and the customer message', async () => {
    const user = userEvent.setup()
    const calls = stubFetch()
    render(<PurchaseTrail userId="5" token="access-token" user={adminUser} customerCountry="BR" />)

    const steps = await screen.findByRole('table', { name: 'Passos da tentativa' })
    expect(screen.getByRole('heading', { name: 'Trilha de compra · Brasil' })).toBeInTheDocument()
    expect(document.querySelector('summary .badge-error')).toHaveTextContent('Falhou')
    expect(within(steps).getByText('invalid_zipcode')).toBeInTheDocument()
    expect(within(steps).getByText('stripe_subscription_failed · Stripe: card_declined')).toBeInTheDocument()
    expect(within(steps).getAllByText('Cartão recusado.')).toHaveLength(1)
    expect(screen.queryByText('recipe_life_stage_mismatch')).not.toBeInTheDocument()
    expect(calls).toContain('/api/v1/admin/users/5/purchase-trail?market=br')
    expect(calls).toContain('/api/v1/admin/purchase-trail/config-events?market=br')

    await user.click(within(screen.getByRole('group', { name: 'Mercado' })).getByRole('button', { name: 'Estados Unidos' }))
    await waitFor(() => expect(screen.getByText('recipe_life_stage_mismatch')).toBeInTheDocument())
    expect(screen.queryByText('invalid_zipcode')).not.toBeInTheDocument()
    expect(screen.getByText('first_purchase_coupon.create')).toBeInTheDocument()
    expect(calls).toContain('/api/v1/admin/users/5/purchase-trail?market=us')
  })

  it('has no write control, and a BR-only role reads BR only', async () => {
    stubFetch()
    render(<PurchaseTrail userId="5" token="access-token" user={readonlyUser} customerCountry="US" />)
    await screen.findByRole('table', { name: 'Passos da tentativa' })
    expect(screen.queryByRole('group', { name: 'Mercado' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Trilha de compra · Brasil' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
