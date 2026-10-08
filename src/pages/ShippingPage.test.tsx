import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShippingPage } from './ShippingPage'
import { adminUser, operatorWriteUser, readonlyUser } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('ShippingPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('saves only the Brazil rules, without the headquarters address', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<ShippingPage />, '/config/shipping')

    await waitFor(() => {
      expect(screen.getByText('CD SP')).toBeInTheDocument()
    })
    expect(screen.queryByRole('tab', { name: 'Estados Unidos' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Latitude')).not.toBeInTheDocument()
    expect(screen.queryByText('Km/dia')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Salvar regras do Brasil' }))

    await waitFor(() => {
      expect(screen.getByText('Regras do Brasil salvas.')).toBeInTheDocument()
    })

    const put = calls.find((call) => call.method === 'PUT' && call.path === '/api/v1/admin/shipping/settings')
    expect(put?.authorization).toBe('Bearer access-token')
    expect(put?.body).toMatchObject({ br: { rule: { per_km: 0.95 } } })
    expect((put?.body as { br: Record<string, unknown> }).br).not.toHaveProperty('center')
    expect(put?.body).not.toHaveProperty('us')
  })

  it('hides every mutation from readonly accounts', async () => {
    seedAuth()
    installAdminFetchMock(readonlyUser)
    renderAuthedPage(<ShippingPage />, '/config/shipping')

    await waitFor(() => {
      expect(screen.getByText('CD SP')).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: /Salvar regras/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /endereço/ })).not.toBeInTheDocument()
  })

  it('validates the Brazil headquarters address before saving it', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(adminUser)
    renderAuthedPage(<ShippingPage />, '/config/shipping')

    const card = await screen.findByRole('article', { name: 'Sede Brasil' })
    await user.click(within(card).getByRole('button', { name: 'Cadastrar endereço' }))

    const save = within(card).getByRole('button', { name: 'Salvar sede' })
    expect(save).toBeDisabled()

    await user.clear(within(card).getByLabelText(/^CEP/))
    await user.type(within(card).getByLabelText(/^CEP/), '01310100')
    await user.tab()
    await waitFor(() => {
      expect(within(card).getByLabelText(/^Rua/)).toHaveValue('Avenida Paulista')
    })
    await user.type(within(card).getByLabelText(/^Número/), '1000')

    await user.click(within(card).getByRole('button', { name: 'Validar endereço' }))
    await waitFor(() => {
      expect(within(card).getByText('Endereço válido')).toBeInTheDocument()
    })
    expect(within(card).getByText(/-23\.56520, -46\.65140/)).toBeInTheDocument()

    await user.click(save)
    await waitFor(() => {
      expect(screen.getByText('Sede do Brasil salva.')).toBeInTheDocument()
    })
    const put = calls.find((call) => call.method === 'PUT' && call.path === '/api/v1/admin/shipping/settings')
    expect(put?.body).toMatchObject({ br: { center: { street: 'Avenida Paulista', number: '1000', zipcode: '01310-100' } } })
  })

  it('uses the US address format and shows field errors from the validation', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(adminUser)
    renderAuthedPage(<ShippingPage />, '/config/shipping')

    const card = await screen.findByRole('article', { name: 'Sede Estados Unidos' })
    await user.click(within(card).getByRole('button', { name: 'Alterar endereço' }))

    expect(within(card).getByLabelText(/^Address line 1/)).toHaveValue('100 Main St')
    expect(within(card).getByLabelText(/^Address line 2/)).toBeInTheDocument()
    expect(within(card).getByLabelText(/^ZIP code/)).toHaveValue('33101')

    await user.click(within(card).getByRole('button', { name: 'Validar endereço' }))
    await waitFor(() => {
      expect(within(card).getByText('O ZIP 33101 é de FL.')).toBeInTheDocument()
    })
    expect(within(card).getByRole('button', { name: 'Salvar sede' })).toBeDisabled()
  })

  it('shows only the UPS fields in UPS mode and runs the sandbox simulation', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(adminUser)
    renderAuthedPage(<ShippingPage />, '/config/shipping')

    await user.click(await screen.findByRole('tab', { name: 'Estados Unidos' }))
    expect(screen.getByRole('heading', { name: 'Valor fixo' })).toBeInTheDocument()
    expect(screen.queryByText('Serviços aceitos')).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /UPS/ }))
    expect(screen.getByText('Serviços aceitos')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Valor de reserva' })).toBeInTheDocument()

    await user.click(screen.getByRole('switch', { name: /Se a UPS falhar/ }))
    expect(screen.queryByRole('heading', { name: 'Valor de reserva' })).not.toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('94105'), '94105')
    await user.click(screen.getByRole('button', { name: 'Simular' }))

    await waitFor(() => {
      expect(screen.getByText('Autenticação OAuth')).toBeInTheDocument()
    })
    expect(screen.getByText('Cotação com prazo (Shoptimeintransit)')).toBeInTheDocument()
    expect(screen.getAllByText('$18.45').length).toBeGreaterThan(0)
    expect(within(screen.getByRole('table')).getByText('UPS Next Day Air')).toBeInTheDocument()
    const post = calls.find((call) => call.method === 'POST' && call.path === '/api/v1/admin/shipping/test')
    expect(post?.body).toEqual({ zipCode: '94105', country: 'US' })
  })

  it('simulates a Brazil CEP as same-day delivery', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<ShippingPage />, '/config/shipping')

    await screen.findByText('CD SP')
    await user.type(screen.getByPlaceholderText('01310-100'), '01310100')
    await user.click(screen.getByRole('button', { name: 'Simular' }))

    await waitFor(() => {
      expect(screen.getByText('No mesmo dia do preparo')).toBeInTheDocument()
    })
    expect(screen.getByText(/8\.2 km de rota/)).toBeInTheDocument()
  })
})
