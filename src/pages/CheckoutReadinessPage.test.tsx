import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CheckoutReadiness, ReadinessNote, ReadinessWarning } from '../lib/checkoutReadiness'
import { adminUser } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'
import { CheckoutReadinessPage } from './CheckoutReadinessPage'

const readiness = (warnings: CheckoutReadiness['warnings'], notes: CheckoutReadiness['notes'] = []): CheckoutReadiness => ({
  checked_at: '2026-11-18T12:00:00.000Z',
  config: { stripe_br_enabled: true, stripe_secret_key_present: { BR: true, US: false }, ups_configured: true },
  warnings,
  notes,
})

const usShipping: ReadinessWarning = { key: 'shipping:US', code: 'us_ups_quote_fallback', market: 'US', severity: 'high', action: 'shipping_us', details: {} }
const brCoupon: ReadinessWarning = { key: 'coupon:BR', code: 'coupon_missing', market: 'BR', severity: 'medium', action: 'coupons', details: { terms: [3] } }
const brCenter: ReadinessWarning = { key: 'center:BR', code: 'br_center_missing', market: 'BR', severity: 'high', action: 'shipping_br', details: {} }
const usKey: ReadinessWarning = { key: 'secret_key:US', code: 'stripe_secret_key_missing', market: 'US', severity: 'high', action: null, details: {} }
const usCatalog: ReadinessWarning = { key: 'catalog:US', code: 'catalog_prices_missing', market: 'US', severity: 'high', action: 'products', details: {} }
const upsNote: ReadinessNote = { key: 'ups:US', code: 'ups_unverified', market: 'US' }

function open(data: CheckoutReadiness, route = '/operations/checkout-readiness') {
  seedAuth()
  installAdminFetchMock(adminUser, { checkoutReadiness: data })
  return renderAuthedPage(<CheckoutReadinessPage />, route, '/operations/checkout-readiness')
}


describe('CheckoutReadinessPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('lists every warning with severity, message and the button that fixes it, worst first', async () => {
    open(readiness([brCoupon, usShipping, brCenter, usCatalog]))

    expect(await screen.findByText(/A cotação da UPS cai no valor de reserva/)).toBeInTheDocument()
    const items = document.querySelectorAll('ul.day-pending > li')
    expect(items).toHaveLength(4)
    expect(items[items.length - 1]).toHaveTextContent('Média')
    expect(items[items.length - 1]).toHaveTextContent('O cupom de 1ª compra de 3 meses do Brasil não está vinculado ou está inativo')
    expect(screen.getByRole('link', { name: 'Cupons de 1ª compra' })).toHaveAttribute('href', '/billing/coupons')
    expect(screen.getByRole('link', { name: 'Produtos' })).toHaveAttribute('href', '/catalog/products')
    const shipping = screen.getAllByRole('link', { name: 'Regras de frete' }).map((link) => link.getAttribute('href'))
    expect(shipping.sort()).toEqual(['/config/shipping?mercado=br', '/config/shipping?mercado=us'])
  })

  it('Brasil hides the US warnings and the US UPS note', async () => {
    open(readiness([usShipping, brCoupon], [upsNote]))
    expect(await screen.findByText('Não foi possível consultar a UPS agora.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Brasil' }))

    expect(screen.getByText(/cupom de 1ª compra de 3 meses do Brasil/)).toBeInTheDocument()
    expect(screen.queryByText(/A cotação da UPS/)).not.toBeInTheDocument()
    expect(screen.queryByText('Não foi possível consultar a UPS agora.')).not.toBeInTheDocument()
  })

  it('EUA with no US warning says nothing blocks the US checkout', async () => {
    open(readiness([brCoupon]), '/operations/checkout-readiness?pais=us')

    expect(await screen.findByText('Nada bloqueia o checkout dos EUA.')).toBeInTheDocument()
    expect(screen.queryByText(/cupom de 1ª compra/)).not.toBeInTheDocument()
  })

  it('a missing key says "ausente", shows no key text and has no button', async () => {
    open(readiness([usKey]))

    const message = await screen.findByText(/Chave secreta da Stripe dos EUA: ausente/)
    const row = message.closest('li') as HTMLElement
    expect(within(row).queryByRole('link')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/sk_|pk_|whsec_/)
  })

  it('notes are not counted as warnings', async () => {
    open(readiness([], [upsNote]))

    expect(await screen.findByText('Nada bloqueia o checkout da loja.')).toBeInTheDocument()
    expect(screen.getByText('Não foi possível consultar a UPS agora.')).toBeInTheDocument()
  })
})
