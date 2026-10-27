import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CouponsPage } from './CouponsPage'
import { firstPurchasePromoHealth, jsonResponse, operatorWriteUser } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('CouponsPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('shows one card per term from the stored map and syncs with Stripe', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<CouponsPage />, '/billing/coupons')

    const oneMonth = await screen.findByRole('article', { name: 'Prazo 1 mês' })
    await waitFor(() => {
      expect(within(oneMonth).getByText('FIRST_1M')).toBeInTheDocument()
    })
    expect(within(oneMonth).getByText('10% na 1ª fatura')).toBeInTheDocument()
    expect(within(oneMonth).getByText('Ativo')).toBeInTheDocument()
    expect(within(oneMonth).getByText('promo_1m')).toBeInTheDocument()
    expect(within(oneMonth).getByText('coupon_1')).toBeInTheDocument()
    expect(within(screen.getByRole('article', { name: 'Prazo 3 meses' })).getByText('Vinculado')).toBeInTheDocument()

    const table = screen.getByRole('table')
    expect(within(table).getByText('OPEN')).toBeInTheDocument()
    expect(within(table).getByText('Não expira')).toBeInTheDocument()
    expect(within(table).getByText('Só a 1ª fatura')).toBeInTheDocument()
    expect(within(table).queryByText('1m')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sincronizar com Stripe' }))

    await waitFor(() => {
      expect(screen.getByText('Mapa sincronizado com a Stripe.')).toBeInTheDocument()
    })

    const sync = calls.find((call) => call.method === 'POST' && call.path === '/api/v1/admin/stripe/first-purchase-promos/sync')
    expect(sync?.authorization).toBe('Bearer access-token')
    expect(sync?.search).toBe('?account=br')
    expect(sync?.body).toMatchObject({ account: 'br' })
  })

  it('creates a coupon in Stripe from a term card', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<CouponsPage />, '/billing/coupons')

    await user.click(await screen.findByRole('button', { name: 'Substituir cupom de 3 meses' }))

    const dialog = screen.getByRole('dialog', { name: 'Criar cupom na Stripe' })
    expect(within(dialog).getByLabelText('Prazo')).toHaveValue('3')
    expect(within(dialog).getByText(/Substitui o código atual de 3 meses/)).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText('Código'), 'bemvindo25')
    await user.click(within(dialog).getByRole('button', { name: 'Criar na Stripe' }))

    await waitFor(() => {
      expect(screen.getByText('Cupom criado na Stripe e gravado no banco.')).toBeInTheDocument()
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    const create = calls.find((call) => call.method === 'POST' && call.path === '/api/v1/admin/stripe/first-purchase-coupons')
    expect(create?.body).toMatchObject({
      term_months: 3,
      code: 'BEMVINDO25',
      max_redemptions: 0,
      assign_first_purchase_slot: true,
      account: 'br',
    })
  })

  it('shows a create failure inside the dialog and keeps the typed code', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      routes: (call) => (
        call.method === 'POST' && call.path === '/api/v1/admin/stripe/first-purchase-coupons'
          ? new Response(JSON.stringify({ success: false, message: 'Received unknown parameter: coupon' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
          : undefined
      ),
    })
    renderAuthedPage(<CouponsPage />, '/billing/coupons')

    await user.click(await screen.findByRole('button', { name: 'Substituir cupom de 1 mês' }))
    const dialog = screen.getByRole('dialog', { name: 'Criar cupom na Stripe' })
    await user.type(within(dialog).getByLabelText('Código'), 'first_purchase_1m')
    await user.click(within(dialog).getByRole('button', { name: 'Criar na Stripe' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Não foi possível criar o cupom: Received unknown parameter: coupon')
    expect(within(dialog).getByLabelText('Código')).toHaveValue('FIRST_PURCHASE_1M')
    expect(screen.queryByText('Cupom criado na Stripe e gravado no banco.')).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    await user.click(screen.getByRole('button', { name: 'Substituir cupom de 1 mês' }))
    expect(within(screen.getByRole('dialog')).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('saves a manual promo map with PUT', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<CouponsPage />, '/billing/coupons')

    await waitFor(() => {
      expect(screen.getByDisplayValue('promo_1m')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Vincular ID manualmente'))
    await user.click(screen.getByRole('button', { name: 'Salvar mapa' }))

    await waitFor(() => {
      expect(screen.getByText('Mapa salvo no banco.')).toBeInTheDocument()
    })

    const put = calls.find((call) => call.method === 'PUT' && call.path === '/api/v1/admin/stripe/first-purchase-promos')
    expect(put?.body).toMatchObject({ 1: 'promo_1m', 3: 'promo_3m', 6: 'promo_6m', account: 'br' })
  })

  it('defaults the coupon account to the operator market', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<CouponsPage />, '/billing/coupons')

    await waitFor(() => {
      expect(screen.getByDisplayValue('promo_1m')).toBeInTheDocument()
    })

    const account = screen.getByLabelText('Conta')
    expect(account).toHaveValue('br')
    expect(account).toBeDisabled()
    expect(screen.queryByRole('option', { name: 'US' })).not.toBeInTheDocument()
    expect(calls.some((call) => (
      call.method === 'GET'
      && call.path === '/api/v1/admin/stripe/first-purchase-promos'
      && call.search === '?account=br'
    ))).toBe(true)
    expect(calls.some((call) => call.search === '?account=us')).toBe(false)
  })

  describe('percent of a new coupon', () => {
    it('raises the 3-month percent and warns about the terms of use', async () => {
      const user = userEvent.setup()
      seedAuth()
      const { calls } = installAdminFetchMock(operatorWriteUser)
      renderAuthedPage(<CouponsPage />, '/billing/coupons')

      await within(await screen.findByRole('article', { name: 'Prazo 1 mês' })).findByText('FIRST_1M')
      await user.click(screen.getByRole('button', { name: 'Substituir cupom de 3 meses' }))
      const dialog = screen.getByRole('dialog', { name: 'Criar cupom na Stripe' })
      const percent = within(dialog).getByLabelText('Desconto na 1ª fatura (%)')
      expect(percent).toHaveValue(25)
      expect(within(dialog).queryByText(/termos de uso/)).not.toBeInTheDocument()

      await user.clear(percent)
      await user.type(percent, '30')
      expect(within(dialog).getByText(/Os novos checkouts de 3 meses passam de 25% para 30%.*Os termos de uso citam o percentual/)).toBeInTheDocument()
      expect(within(dialog).getByLabelText('Código')).toHaveAttribute('placeholder', 'BEMVINDO30')

      await user.click(within(dialog).getByLabelText('Usar no checkout de 3 meses'))
      expect(within(dialog).getByText('Sem usar no checkout, o percentual de 3 meses continua 25%.')).toBeInTheDocument()
      await user.click(within(dialog).getByLabelText('Usar no checkout de 3 meses'))

      await user.type(within(dialog).getByLabelText('Código'), 'bemvindo30')
      await user.click(within(dialog).getByRole('button', { name: 'Criar na Stripe' }))

      await screen.findByText('Cupom criado na Stripe e gravado no banco.')
      const create = calls.find((call) => call.method === 'POST' && call.path === '/api/v1/admin/stripe/first-purchase-coupons')
      expect(create?.body).toMatchObject({ term_months: 3, percent_off: 30, assign_first_purchase_slot: true })
    })

    it('sends the stored percent when untouched and follows the chosen term', async () => {
      const user = userEvent.setup()
      seedAuth()
      const { calls } = installAdminFetchMock(operatorWriteUser)
      renderAuthedPage(<CouponsPage />, '/billing/coupons')

      await within(await screen.findByRole('article', { name: 'Prazo 1 mês' })).findByText('FIRST_1M')
      await user.click(screen.getByRole('button', { name: 'Substituir cupom de 3 meses' }))
      const dialog = screen.getByRole('dialog', { name: 'Criar cupom na Stripe' })
      await user.selectOptions(within(dialog).getByLabelText('Prazo'), '1')
      expect(within(dialog).getByLabelText('Desconto na 1ª fatura (%)')).toHaveValue(10)

      await user.type(within(dialog).getByLabelText('Código'), 'first10')
      await user.click(within(dialog).getByRole('button', { name: 'Criar na Stripe' }))

      await screen.findByText('Cupom criado na Stripe e gravado no banco.')
      const create = calls.find((call) => call.method === 'POST' && call.path === '/api/v1/admin/stripe/first-purchase-coupons')
      expect(create?.body).toMatchObject({ term_months: 1, percent_off: 10 })
      expect(within(dialog).queryByText(/termos de uso/)).not.toBeInTheDocument()
    })

    it('warns on a term card whose coupon gives another percent', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, {
        routes: (call) => (
          call.method === 'GET' && call.path === '/api/v1/admin/stripe/first-purchase-promos'
            ? jsonResponse({
              ...firstPurchasePromoHealth,
              slots: {
                1: { promotion_code_id: 'promo_1m', coupon_id: 'coupon_1', active: true, source: 'stripe', percent_off: 15, percent_mismatch: true },
                3: { promotion_code_id: 'promo_3m', coupon_id: 'coupon_3', active: true, source: 'stripe', percent_off: 25, percent_mismatch: false },
              },
            })
            : undefined
        ),
      })
      renderAuthedPage(<CouponsPage />, '/billing/coupons')

      const oneMonth = await screen.findByRole('article', { name: 'Prazo 1 mês' })
      expect(await within(oneMonth).findByText(/Cupom dá 15%, não 10%/)).toBeInTheDocument()
      expect(within(screen.getByRole('article', { name: 'Prazo 3 meses' })).queryByText(/Cupom dá/)).not.toBeInTheDocument()
    })
  })

  describe('term percents', () => {
    // Coupon health answered with the given terms; every other route keeps the default mock.
    function withHealth(health: Record<string, unknown>) {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, {
        routes: (call) => (
          call.method === 'GET' && call.path === '/api/v1/admin/stripe/first-purchase-promos'
            ? jsonResponse(health)
            : undefined
        ),
      })
      renderAuthedPage(<CouponsPage />, '/billing/coupons')
    }

    const raisedTerms = {
      ...firstPurchasePromoHealth,
      terms: [
        { subscription_term_months: 1, discount_percent: 10 },
        { subscription_term_months: 3, discount_percent: 30 },
        { subscription_term_months: 6, discount_percent: 40 },
      ],
    }

    it('shows the percents of the response on the cards and in the form', async () => {
      const user = userEvent.setup()
      withHealth(raisedTerms)

      const threeMonths = await screen.findByRole('article', { name: 'Prazo 3 meses' })
      expect(await within(threeMonths).findByText('30% na 1ª fatura')).toBeInTheDocument()
      await within(screen.getByRole('article', { name: 'Prazo 1 mês' })).findByText('FIRST_1M')

      await user.click(screen.getByRole('button', { name: 'Substituir cupom de 3 meses' }))
      const dialog = screen.getByRole('dialog', { name: 'Criar cupom na Stripe' })
      expect(within(dialog).getByRole('option', { name: '3 meses — 30%' })).toBeInTheDocument()
      expect(within(dialog).getByLabelText('Código')).toHaveAttribute('placeholder', 'BEMVINDO30')
      expect(within(dialog).getByLabelText('Nome (opcional)')).toHaveAttribute('placeholder', 'First purchase 3m (30%)')
    })

    it('cites the 3 and 6 month percents of the response in the note', async () => {
      withHealth(raisedTerms)

      expect(await screen.findByText(/O percentual maior \(30%\/40%\) é benefício de compromisso/)).toBeInTheDocument()
    })

    it('shows a dash and no fixed percent when the response has no terms', async () => {
      const user = userEvent.setup()
      withHealth({ ...firstPurchasePromoHealth, terms: undefined })

      const oneMonth = await screen.findByRole('article', { name: 'Prazo 1 mês' })
      // The card is loaded once its stored code shows; the percent cells come only from the response.
      expect(await within(oneMonth).findByText('FIRST_1M')).toBeInTheDocument()
      expect(within(oneMonth).getByText('- na 1ª fatura')).toBeInTheDocument()
      for (const name of ['Prazo 1 mês', 'Prazo 3 meses', 'Prazo 6 meses']) {
        expect(within(screen.getByRole('article', { name })).queryByText(/%/)).not.toBeInTheDocument()
      }
      expect(screen.getByText(/O percentual maior é benefício de compromisso/)).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Substituir cupom de 1 mês' }))
      const dialog = screen.getByRole('dialog', { name: 'Criar cupom na Stripe' })
      expect(within(dialog).getByLabelText('Código')).toHaveAttribute('placeholder', 'BEMVINDO')
      expect(within(dialog).getByLabelText('Nome (opcional)')).toHaveAttribute('placeholder', 'First purchase 1m')
    })
  })
})
